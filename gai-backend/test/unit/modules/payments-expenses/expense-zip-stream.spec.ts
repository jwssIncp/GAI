import { unzipSync } from 'fflate';
import { ExpenseTransferService } from '../../../../src/modules/payments-expenses/application/services/expense-transfer.service';
import type { ExpenseBoardItem } from '../../../../src/modules/payments-expenses/application/services/project-expenses.service';

const item = (id: number, agent: string | null): ExpenseBoardItem => ({
  id,
  sequence: id,
  expense_type: 'reimbursable',
  expense_type_label: 'Reembolsável',
  contract_type_label: 'Reembolsável',
  reason_code: 'Transporte',
  description: 'Táxi',
  legacy_reason: null,
  expense_date: '2026-11-05',
  field_agent_id: agent ? id : null,
  field_agent_name: agent ?? 'Despesas gerais',
  payment_method: 'cash',
  payment_method_label: 'À vista',
  installments: [],
  invoiced_payment_date: null,
  attachments: 1,
  amount: '10.00',
  deposited_amount: null,
  balance: null,
  status: 'approved',
  rejection_reason: null,
  batch: null,
  to_reimburse: true,
  reopened_at: null,
  updated_at: '2026-11-05T00:00:00.000Z',
});

describe('ZIP de comprovantes em streaming', () => {
  it('lê o armazenamento em pedaços e só avança quando o destino drena; nunca junta os comprovantes', async () => {
    const CHUNK = 64 * 1024;
    const SIZE = 2 * 1024 * 1024; // 2 MB por comprovante, 3 comprovantes
    const log: string[] = [];
    let ahead = 0; // pedaços lidos do armazenamento e ainda não escritos no destino
    let maxAhead = 0;
    const storage = {
      openObject: jest.fn((input: { path: string }) => {
        log.push(`abre ${input.path}`);
        return Promise.resolve(
          (async function* () {
            for (let i = 0; i < SIZE; i += CHUNK) {
              ahead += 1;
              maxAhead = Math.max(maxAhead, ahead);
              yield new Uint8Array(CHUNK).fill(i % 251);
            }
            log.push(`fim ${input.path}`);
          })(),
        );
      }),
    };
    const service = new ExpenseTransferService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { presignedUrlTtlSeconds: () => 60 } as never,
      storage as never,
    );
    const out: Buffer[] = [];
    const sink = {
      // Destino lento: cada escrita espera uma volta do laço de eventos.
      write: async (chunk: Uint8Array) => {
        await new Promise((r) => setImmediate(r));
        out.push(Buffer.from(chunk));
        ahead = Math.max(0, ahead - 1);
      },
      end: () => Promise.resolve(),
    };
    const items = [item(1, 'Ana'), item(2, 'Bruno'), item(3, null)];
    const attachments = items.map((i) => ({
      id: i.id,
      expenseId: i.id,
      bucket: 'b',
      path: `p${i.id}`,
      mimeType: 'application/pdf',
      sizeBytes: SIZE,
      checksum: null,
      originalName: `nota${i.id}.pdf`,
    }));
    await (
      service as unknown as {
        writeZip: (...a: unknown[]) => Promise<void>;
      }
    ).writeZip(
      'Projeto',
      items,
      attachments,
      new Map(items.map((i) => [i.id, i])),
      sink,
    );
    // Um comprovante por vez: o próximo só abre depois que o anterior terminou.
    expect(log).toEqual([
      'abre p1',
      'fim p1',
      'abre p2',
      'fim p2',
      'abre p3',
      'fim p3',
    ]);
    // Nunca mais de 2 pedaços (128 KB) lidos à frente do que já foi escrito,
    // contra 6 MB de comprovantes no total.
    expect(maxAhead).toBeLessThanOrEqual(2);
    const files = unzipSync(new Uint8Array(Buffer.concat(out)));
    expect(Object.keys(files).sort()).toEqual([
      'Comprovantes por técnico/Ana/1-nota1.pdf',
      'Comprovantes por técnico/Bruno/2-nota2.pdf',
      'Despesas Gerais/3-nota3.pdf',
      'Lançamentos - Projeto.xlsx',
    ]);
    expect(files['Despesas Gerais/3-nota3.pdf']).toHaveLength(SIZE);
  });
});
