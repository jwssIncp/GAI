import { INestApplication } from '@nestjs/common';
import { unzipSync, strFromU8 } from 'fflate';
import request from 'supertest';
import { DataSource } from 'typeorm';
import * as XLSX from 'xlsx';
import { STORAGE_SIGNER } from '../../../src/common/storage/storage-signer.port';
import { ContractEntity } from '../../../src/modules/contracts/contract.entity';
import { FakeStorage, TEST_OBJECT_CHECKSUM } from '../storage.fake';
import {
  createTestApp,
  loginAsOrgAdmin,
  loginAsOrgUser,
  seedTestData,
} from '../test-app.helper';

type Item = {
  id: number;
  sequence: number;
  expense_type: string | null;
  reason_code: string | null;
  status: string;
  amount: string;
  balance: string | null;
  to_reimburse: boolean;
  installments: Array<{ due_date: string; amount: string }>;
  batch: { id: number; number: number; status: string } | null;
  field_agent_name: string;
};

/**
 * Etapa 4 (Despesas, doc 06 §3): campos novos, código sequencial, parcelas D-E,
 * rejeição sem perder o motivo, reabrir, tipo e exclusão em lote, lotes de
 * reembolso (D-B) e "A reembolsar" com regra única, adiantamentos e saldo,
 * conclusão do financeiro, exportação, importação e ZIP com comprovantes.
 */
describe('Despesas do projeto (e2e, etapa 4)', () => {
  let app: INestApplication;
  let admin: string;
  let user: string;
  let project: number;
  let ana: number;
  let bruno: number;
  const api = (
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    token = admin,
  ) =>
    request(app.getHttpServer())
      [method]('/api/v1' + path)
      .set('Authorization', 'Bearer ' + token);
  const board = async (query = '') =>
    (await api('get', `/projects/${project}/expense-board${query}`).expect(200))
      .body as {
      kpis: Record<string, string | number | null>;
      summary: Array<{
        field_agent_id: number | null;
        name: string;
        advances: string;
        expenses: string;
        balance: string;
        entries: number;
      }>;
      items: Item[];
      totals: {
        count: number;
        amount: string;
        non_reimbursable_amount: string;
      };
      default_expense_type: string | null;
      closure: unknown;
    };
  const create = (body: Record<string, unknown>) =>
    api('post', `/projects/${project}/expenses`).send({
      description: 'Despesa de campo',
      expense_date: '2026-10-05',
      amount: '100.00',
      ...body,
    });

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    admin = await loginAsOrgAdmin(app);
    user = await loginAsOrgUser(app);
    project = (
      await api('post', '/projects')
        .send({ organization_id: 1, company_id: 1, name: 'Despesas etapa 4' })
        .expect(201)
    ).body.id;
    for (const name of ['Ana Campo', 'Bruno Campo']) {
      const id = (await api('post', '/field-agents').send({ name }).expect(201))
        .body.id as number;
      await api('post', `/projects/${project}/field-agents`)
        .send({ field_agent_id: id, role: 'collector' })
        .expect(201);
      if (name.startsWith('Ana')) ana = id;
      else bruno = id;
    }
    // Contrato com "despesas por conta do cliente": padrão = reembolsável.
    await app
      .get(DataSource)
      .getRepository(ContractEntity)
      .save({
        organizationId: 1,
        projectId: project,
        companyId: 1,
        number: 'CT-E4',
        revision: 1,
        data: {
          status: 'active',
          expenses_paid_by: 'client',
          current_value: '10000.00',
          services: ['Inventário'],
        } as never,
      });
    const defaults = (
      await api('get', '/finance-settings/defaults').expect(200)
    ).body as Record<string, unknown>;
    await api('post', '/finance-settings')
      .send({
        valid_from: '2026-01-01',
        reason: 'Parametros do teste',
        values: defaults,
      })
      .expect(201);
  });
  afterAll(async () => {
    await app?.close();
  });

  it('cria com tipo padrão do contrato, motivo da lista, código sequencial e parcelas D-E', async () => {
    const a = (
      await create({
        field_agent_id: ana,
        reason_code: 'Transporte',
        payment_method: 'cash',
        deposited_amount: '150.00',
      }).expect(201)
    ).body;
    expect(a).toMatchObject({
      expense_type: 'reimbursable',
      reason_code: 'Transporte',
      project_sequence: 1,
      deposited_amount: '150.00',
    });
    await create({ reason_code: 'Hospedagem' }).expect(400); // fora da lista
    const b = (
      await create({
        field_agent_id: ana,
        amount: '100.00',
        expense_type: 'non_reimbursable',
        reason_code: 'Refeição',
        payment_method: 'installments',
        installment_count: 3,
        expense_date: '2026-01-31',
      }).expect(201)
    ).body;
    expect(b.project_sequence).toBe(2);
    const c = (
      await create({
        field_agent_id: bruno,
        amount: '80.00',
        reason_code: 'Lanche',
        payment_method: 'invoiced',
        invoiced_payment_date: '2026-11-10',
      }).expect(201)
    ).body;
    await create({ payment_method: 'invoiced' }).expect(400); // faturado sem data
    const general = (
      await create({ amount: '40.00', reason_code: 'Outros' }).expect(201)
    ).body; // sem técnico: despesas gerais
    expect([c.project_sequence, general.project_sequence]).toEqual([3, 4]);

    let items = (await board()).items;
    const parcelas = items.find((i) => i.id === b.id)!.installments;
    expect(parcelas.map((p) => [p.due_date, p.amount])).toEqual([
      ['2026-02-28', '33.33'],
      ['2026-03-31', '33.33'],
      ['2026-04-30', '33.34'],
    ]);
    // Grade editada é preservada; editar a observação não refaz as parcelas.
    await api('patch', `/projects/${project}/expenses/${b.id}`)
      .send({
        description: 'Refeições',
        expense_date: '2026-01-31',
        amount: '100.00',
        field_agent_id: ana,
        payment_method: 'installments',
        installments: [
          { due_date: '2026-02-10', amount: '50.00' },
          { due_date: '2026-03-10', amount: '50.00' },
        ],
      })
      .expect(200);
    await api('patch', `/projects/${project}/expenses/${b.id}`)
      .send({
        description: 'Refeições da equipe',
        expense_date: '2026-01-31',
        amount: '100.00',
        field_agent_id: ana,
        payment_method: 'installments',
      })
      .expect(200);
    items = (await board()).items;
    expect(
      items.find((i) => i.id === b.id)!.installments.map((p) => p.amount),
    ).toEqual(['50.00', '50.00']);
    await api('patch', `/projects/${project}/expenses/${b.id}`)
      .send({
        description: 'x',
        expense_date: '2026-01-31',
        amount: '100.00',
        payment_method: 'installments',
        installments: [{ due_date: '2026-02-10', amount: '60.00' }],
      })
      .expect(400); // soma diferente do valor
    expect(items.find((i) => i.id === a.id)!.balance).toBe('50.00'); // depositado − valor
  });

  it('rejeitar guarda o motivo à parte; reabrir volta aprovada para pendente com justificativa', async () => {
    const e = (
      await create({
        field_agent_id: bruno,
        reason: 'Motivo original',
        reason_code: 'Transporte',
      }).expect(201)
    ).body;
    const rejected = (
      await api('post', `/projects/${project}/expenses/${e.id}/reject`)
        .send({ reason: 'Sem nota fiscal' })
        .expect(200)
    ).body;
    expect(rejected).toMatchObject({
      status: 'rejected',
      reason: 'Motivo original',
      rejection_reason: 'Sem nota fiscal',
    });
    const f = (
      await create({ field_agent_id: bruno, reason_code: 'Lanche' }).expect(201)
    ).body;
    await api('post', `/projects/${project}/expenses/${f.id}/approve`).expect(
      200,
    );
    await api('patch', `/projects/${project}/expenses/${f.id}`)
      .send({ description: 'x', expense_date: '2026-10-05', amount: '100.00' })
      .expect(409);
    await api('post', `/projects/${project}/expenses/${f.id}/reopen`)
      .send({ reason: 'abc' })
      .expect(400);
    const reopened = (
      await api('post', `/projects/${project}/expenses/${f.id}/reopen`)
        .send({ reason: 'Corrigir o valor' })
        .expect(200)
    ).body;
    expect(reopened.status).toBe('pending');
    expect(reopened.reopened_at).toBeTruthy();
  });

  it('KPIs, resumo, tipo e exclusão em lote; "A reembolsar" com regra única', async () => {
    let data = await board();
    // reembolsáveis contadas: 100 (a) + 80 (c) + 40 (geral) + 100 (f) = 320; não reembolsável: 100 (b); rejeitada fora
    expect(data.kpis).toMatchObject({
      total: '420.00',
      reimbursable: '320.00',
      non_reimbursable: '100.00',
      to_reimburse: '320.00',
      count: 5,
    });
    expect(data.default_expense_type).toBe('reimbursable');
    const general = data.items.find(
      (i) => i.field_agent_name === 'Despesas gerais',
    )!;
    const r = (
      await api('post', `/projects/${project}/expense-board/type`)
        .send({ ids: [general.id], expense_type: 'non_reimbursable' })
        .expect(200)
    ).body;
    expect(r.done).toBe(1);
    data = await board('?expense_type=non_reimbursable');
    expect(data.items.map((i) => i.id)).toContain(general.id);
    expect(data.totals.non_reimbursable_amount).toBe('140.00');
    expect(
      (await board('?field_agent_id=none')).items.map((i) => i.id),
    ).toEqual([general.id]);
    expect(
      (await board('?search=lanche')).items.every(
        (i) => i.reason_code === 'Lanche',
      ),
    ).toBe(true);
    const del = (
      await api('post', `/projects/${project}/expense-board/delete`)
        .send({ ids: [general.id, 999999] })
        .expect(200)
    ).body;
    expect([del.done, del.failed]).toEqual([1, 1]);
    expect(
      (await board()).items.find((i) => i.id === general.id),
    ).toBeUndefined();
  });

  it('prestar conta (lote de reembolso): faturar tira de "A reembolsar"; reabrir e cancelar devolvem', async () => {
    const reimbursable = (
      await board('?expense_type=reimbursable')
    ).items.filter((i) => i.status !== 'rejected');
    const nonReimb = (await board('?expense_type=non_reimbursable')).items[0];
    await api('post', `/projects/${project}/reimbursement-batches`, user)
      .send({ ids: [reimbursable[0].id] })
      .expect(403);
    const added = (
      await api('post', `/projects/${project}/reimbursement-batches`)
        .send({ ids: [...reimbursable.map((i) => i.id), nonReimb.id] })
        .expect(200)
    ).body;
    expect(added).toMatchObject({
      batch_number: 1,
      done: reimbursable.length,
      failed: 1,
    });
    const batch = added.batch_id as number;
    expect((await board()).kpis.to_reimburse).toBe('280.00'); // lote aberto ainda conta
    await api(
      'post',
      `/projects/${project}/reimbursement-batches/${batch}/bill`,
    )
      .send({ expected_receipt_on: '2026-12-10' })
      .expect(200);
    let data = await board();
    expect(data.kpis.to_reimburse).toBe('0.00');
    expect((await board('?billing=billed')).items).toHaveLength(
      reimbursable.length,
    );
    // Despesa em lote faturado não muda de tipo nem é excluída.
    expect(
      (
        await api('post', `/projects/${project}/expense-board/type`)
          .send({ ids: [reimbursable[0].id], expense_type: 'non_reimbursable' })
          .expect(200)
      ).body.failed,
    ).toBe(1);
    const projects = (await api('get', '/expense-projects').expect(200)).body;
    const row = projects.items.find((p: { id: number }) => p.id === project);
    expect(row).toMatchObject({
      to_reimburse: '0.00',
      reimbursable: '280.00',
      non_reimbursable: '100.00',
      contract_value: '10000.00',
      contract_pct: '3.80',
      finance_closed: false,
    });
    await api(
      'post',
      `/projects/${project}/reimbursement-batches/${batch}/reopen`,
    ).expect(200);
    expect((await board()).kpis.to_reimburse).toBe('280.00');
    await api(
      'post',
      `/projects/${project}/reimbursement-batches/${batch}/cancel`,
    ).expect(200);
    data = await board();
    expect(data.items.every((i) => i.batch === null)).toBe(true);
    const batches = (
      await api('get', `/projects/${project}/reimbursement-batches`).expect(200)
    ).body;
    expect(batches[0]).toMatchObject({
      number: 1,
      status: 'cancelled',
      count: 0,
    });
  });

  it('adiantamentos por projeto e saldo do técnico = adiantamentos − despesas', async () => {
    await api('post', `/projects/${project}/expense-advances`, user)
      .send({
        field_agent_id: ana,
        advanced_on: '2026-10-01',
        amount: '500.00',
      })
      .expect(403);
    const adv = (
      await api('post', `/projects/${project}/expense-advances`)
        .send({
          field_agent_id: ana,
          advanced_on: '2026-10-01',
          amount: '500.00',
          deposited_by_name: 'Financeiro',
        })
        .expect(201)
    ).body;
    await api('post', `/projects/${project}/expense-advances`)
      .send({ field_agent_id: ana, advanced_on: '2026-10-02', amount: '0.00' })
      .expect(400);
    let summary = (await board()).summary.find(
      (s) => s.field_agent_id === ana,
    )!;
    expect(summary).toMatchObject({
      advances: '500.00',
      expenses: '200.00',
      balance: '300.00',
      entries: 2,
    });
    await api('patch', `/projects/${project}/expense-advances/${adv.id}`)
      .send({
        field_agent_id: ana,
        advanced_on: '2026-10-01',
        amount: '150.00',
      })
      .expect(200);
    summary = (await board()).summary.find((s) => s.field_agent_id === ana)!;
    expect(summary.balance).toBe('-50.00');
    expect(
      (await api('get', `/projects/${project}/expense-advances`).expect(200))
        .body,
    ).toHaveLength(1);
    await api(
      'delete',
      `/projects/${project}/expense-advances/${adv.id}`,
    ).expect(200);
    expect(
      (await board()).summary.find((s) => s.field_agent_id === ana)!.advances,
    ).toBe('0.00');
  });

  it('exporta CSV com cabeçalho e linhas do mesmo tamanho e Excel com os filtros', async () => {
    const csv = await api(
      'get',
      `/projects/${project}/expense-board/export?format=csv`,
    ).expect(200);
    const lines = csv.text
      .replace(/^\uFEFF/, '')
      .trim()
      .split('\r\n');
    const width = (l: string) => l.match(/"(?:[^"]|"")*"/g)!.length;
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((l) => width(l) === width(lines[0]))).toBe(true);
    expect(lines[0]).toContain('"Saldo (depositado − valor)"');
    const xlsx = await api(
      'get',
      `/projects/${project}/expense-board/export?format=xlsx&field_agent_id=${ana}`,
    )
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(
      XLSX.read(xlsx.body as Buffer).Sheets.Despesas,
      { header: 1, blankrows: false },
    );
    expect(rows.filter((r) => r[2] === 'Ana Campo')).toHaveLength(2);
  });

  /**
   * Ida e volta: o CSV exportado (separador ";" e vírgula decimal) é importado
   * de novo, sem erro e com os mesmos valores; no Excel, as datas (despesa,
   * faturamento e lote) são datas reais, no mesmo dia da tela.
   */
  it('CSV de ida e volta (";" e vírgula decimal) e datas do Excel sem deslocamento de fuso', async () => {
    const make = async (name: string) => {
      const id = (
        await api('post', '/projects')
          .send({ organization_id: 1, company_id: 1, name })
          .expect(201)
      ).body.id as number;
      const agent = (
        await api('post', '/field-agents')
          .send({ name: `Carla ${name}` })
          .expect(201)
      ).body.id as number;
      await api('post', `/projects/${id}/field-agents`)
        .send({ field_agent_id: agent, role: 'collector' })
        .expect(201);
      return { id, agent };
    };
    const origin = await make('Ida');
    const target = await make('Ida'); // mesmo nome de inventariante no destino
    const post = (body: Record<string, unknown>) =>
      api('post', `/projects/${origin.id}/expenses`)
        .send({
          field_agent_id: origin.agent,
          reason_code: 'Transporte',
          ...body,
        })
        .expect(201);
    await post({
      description: 'Ida e volta à vista',
      expense_date: '2026-03-10',
      amount: '1234.56',
      deposited_amount: '1000.50',
      expense_type: 'reimbursable',
      payment_method: 'cash',
    });
    await post({
      description: 'Ida e volta faturada',
      expense_date: '2026-04-01',
      amount: '99.90',
      expense_type: 'non_reimbursable',
      payment_method: 'invoiced',
      invoiced_payment_date: '2026-04-15',
    });
    await post({
      description: 'Ida e volta parcelada',
      expense_date: '2026-05-31',
      amount: '300.00',
      expense_type: 'reimbursable',
      payment_method: 'installments',
      installment_count: 3,
    });
    const items = (
      await api('get', `/projects/${origin.id}/expense-board`).expect(200)
    ).body.items as Array<{ id: number; expense_type: string }>;
    await api('post', `/projects/${origin.id}/reimbursement-batches`)
      .send({
        ids: items
          .filter((i) => i.expense_type === 'reimbursable')
          .map((i) => i.id),
        batch_date: '2026-06-30',
      })
      .expect(200);

    // CSV: ";" entre campos e vírgula decimal
    const csv = (
      await api(
        'get',
        `/projects/${origin.id}/expense-board/export?format=csv`,
      ).expect(200)
    ).text;
    const lines = csv
      .replace(/^\uFEFF/, '')
      .trim()
      .split('\r\n');
    expect(lines[0].startsWith('"Cód";"Data";"Inventariante"')).toBe(true);
    expect(csv).toContain('"1234,56"');
    expect(csv).toContain('"1000,50"');
    expect(csv).not.toMatch(/"\d+\.\d{1,2}"/); // nenhum valor com ponto decimal
    // importa o mesmo CSV no outro projeto
    const preview = (
      await api('post', `/projects/${target.id}/expense-board/import/preview`)
        .attach('file', Buffer.from(csv, 'utf8'), 'despesas.csv')
        .expect(200)
    ).body as {
      valid: number;
      invalid: number;
      rows: Array<{
        line: number;
        errors: string[];
        values: Record<string, unknown>;
      }>;
    };
    expect(preview.rows.flatMap((r) => r.errors)).toEqual([]);
    expect([preview.valid, preview.invalid]).toEqual([3, 0]);
    const pick = (r: Record<string, unknown>) => ({
      expense_date: r.expense_date,
      amount: r.amount,
      deposited_amount: r.deposited_amount,
      reason_code: r.reason_code,
      expense_type: r.expense_type,
      payment_method: r.payment_method,
      installment_count: r.installment_count,
      invoiced_payment_date: r.invoiced_payment_date,
    });
    expect(
      preview.rows
        .map((r) => pick(r.values))
        .sort((a, b) =>
          String(a.expense_date).localeCompare(String(b.expense_date)),
        ),
    ).toEqual([
      {
        expense_date: '2026-03-10',
        amount: '1234.56',
        deposited_amount: '1000.50',
        reason_code: 'Transporte',
        expense_type: 'reimbursable',
        payment_method: 'cash',
        installment_count: null,
        invoiced_payment_date: null,
      },
      {
        expense_date: '2026-04-01',
        amount: '99.90',
        deposited_amount: null,
        reason_code: 'Transporte',
        expense_type: 'non_reimbursable',
        payment_method: 'invoiced',
        installment_count: null,
        invoiced_payment_date: '2026-04-15',
      },
      {
        expense_date: '2026-05-31',
        amount: '300.00',
        deposited_amount: null,
        reason_code: 'Transporte',
        expense_type: 'reimbursable',
        payment_method: 'installments',
        installment_count: 3,
        invoiced_payment_date: null,
      },
    ]);
    const done = (
      await api('post', `/projects/${target.id}/expense-board/import`)
        .send({
          rows: preview.rows.map((r) => ({ line: r.line, values: r.values })),
        })
        .expect(200)
    ).body;
    expect(done).toMatchObject({ done: 3 });
    const imported = (
      await api('get', `/projects/${target.id}/expense-board`).expect(200)
    ).body.items as Array<{ amount: string; expense_date: string }>;
    expect(imported.map((i) => `${i.expense_date} ${i.amount}`).sort()).toEqual(
      ['2026-03-10 1234.56', '2026-04-01 99.90', '2026-05-31 300.00'],
    );

    // Excel: datas como data, no mesmo dia (despesa, faturamento, lote)
    const xlsx = await api(
      'get',
      `/projects/${origin.id}/expense-board/export?format=xlsx`,
    )
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    const sheet = XLSX.read(xlsx.body as Buffer, { cellNF: true }).Sheets
      .Despesas;
    const day = (r: number, c: number) => {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })] as
        | XLSX.CellObject
        | undefined;
      if (!cell || cell.t !== 'n') return cell?.v ?? null;
      expect(cell.z).toBe('dd/mm/yyyy');
      const d = XLSX.SSF.parse_date_code(cell.v);
      return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    };
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: false,
    });
    const header = rows[0] as string[];
    const col = (name: string) => header.indexOf(name);
    const byDate = new Map(
      rows.slice(1).map((_, i) => [day(i + 1, col('Data')), i + 1] as const),
    );
    expect([...byDate.keys()].filter(Boolean).sort()).toEqual([
      '2026-03-10',
      '2026-04-01',
      '2026-05-31',
    ]);
    expect(day(byDate.get('2026-04-01')!, col('Data de faturamento'))).toBe(
      '2026-04-15',
    );
    expect(day(byDate.get('2026-03-10')!, col('Data do lote'))).toBe(
      '2026-06-30',
    );
    const value = sheet[
      XLSX.utils.encode_cell({ r: byDate.get('2026-03-10')!, c: col('Valor') })
    ] as XLSX.CellObject;
    expect(value).toMatchObject({ t: 'n', v: 1234.56 });
  });

  it('importa Excel/CSV com apelidos de cabeçalho, pré-visualização e erros por linha', async () => {
    const csv = [
      'Data;Técnico;Motivo;Tipo de despesa;Total;Adiantamento;Forma;Parcelas;Observação',
      '03/10/2026;Ana Campo;Transporte;Não reembolsável;1.234,56;;A prazo;2;Táxi',
      '04/10/2026;Fulano;Refeição;Reembolsado;10,00;;;;x',
      '05/10/2026;;Lanche;;25,00;30,00;À vista;;',
    ].join('\n');
    const preview = (
      await api('post', `/projects/${project}/expense-board/import/preview`)
        .attach('file', Buffer.from(csv, 'utf8'), 'despesas.csv')
        .expect(200)
    ).body;
    expect(preview.columns).toMatchObject({
      amount: 'Total',
      deposited_amount: 'Adiantamento',
    });
    expect([preview.valid, preview.invalid]).toEqual([2, 1]);
    const bad = preview.rows.find((r: { line: number }) => r.line === 3);
    // "Reembolsado" não vira reembolsável por aproximação (bug do INVESTOR): é erro.
    expect(bad.errors.join(' ')).toMatch(/Fulano.*não está vinculado/);
    expect(bad.errors.join(' ')).toMatch(/Tipo de despesa deve ser/);
    expect(preview.rows[0].values).toMatchObject({
      expense_type: 'non_reimbursable',
      amount: '1234.56',
      payment_method: 'installments',
      installment_count: 2,
    });
    const valid = preview.rows.filter(
      (r: { errors: string[] }) => !r.errors.length,
    );
    const done = (
      await api('post', `/projects/${project}/expense-board/import`)
        .send({ rows: valid })
        .expect(200)
    ).body;
    expect([done.done, done.failed]).toEqual([2, 0]);
    const imported = (await board('?search=taxi')).items[0];
    expect(imported).toMatchObject({
      amount: '1234.56',
      expense_type: 'non_reimbursable',
    });
    expect(imported.installments.map((p) => p.amount)).toEqual([
      '617.28',
      '617.28',
    ]);
    const general = (await board('?field_agent_id=none')).items[0];
    expect(general).toMatchObject({
      expense_type: 'reimbursable',
      balance: '5.00',
    }); // tipo vazio = padrão do contrato
    // Despesas gerais não recebem adiantamento: sem saldo.
    expect(
      (await board()).summary.find((s) => s.field_agent_id === null)!.balance,
    ).toBeNull();
  });

  it('ZIP: pastas por técnico, Despesas Gerais, planilha e só anexos enviados; cliente só reembolsáveis', async () => {
    const storage = app.get<FakeStorage>(STORAGE_SIGNER);
    const items = (await board()).items;
    const anaItem = items.find(
      (i) =>
        i.field_agent_name === 'Ana Campo' &&
        i.expense_type === 'non_reimbursable',
    )!;
    const general = items.find(
      (i) => i.field_agent_name === 'Despesas gerais',
    )!;
    const attach = async (id: number, name: string, confirm = true) => {
      const up = (
        await api(
          'post',
          `/projects/${project}/expenses/${id}/attachments/upload-url`,
        )
          .send({
            original_name: name,
            mime_type: 'application/pdf',
            size_bytes: 123,
          })
          .expect(201)
      ).body;
      storage.put(up.upload_url, { content: Buffer.from(`PDF ${name}`) });
      if (confirm)
        await api(
          'post',
          `/projects/${project}/expenses/${id}/attachments/${up.attachment.id}/confirm-upload`,
        )
          .send({ checksum: TEST_OBJECT_CHECKSUM, size_bytes: 123 })
          .expect(200);
    };
    await attach(anaItem.id, 'nota.pdf');
    await attach(anaItem.id, 'pendente.pdf', false); // envio não confirmado: fica fora
    await attach(general.id, 'recibo.pdf');
    const zipOf = async (query: string) => {
      const res = await api(
        'get',
        `/projects/${project}/expense-board/zip?${query}`,
      )
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);
      return unzipSync(new Uint8Array(res.body as Buffer));
    };
    const full = await zipOf('kind=full&batch=all');
    const names = Object.keys(full).sort();
    expect(names).toContain(
      `Comprovantes por técnico/Ana Campo/${anaItem.sequence}-nota.pdf`,
    );
    expect(names).toContain(`Despesas Gerais/${general.sequence}-recibo.pdf`);
    expect(names).toContain('Lançamentos - Despesas etapa 4.xlsx');
    expect(names.some((n) => n.includes('pendente'))).toBe(false);
    expect(
      strFromU8(full[`Despesas Gerais/${general.sequence}-recibo.pdf`]),
    ).toBe('PDF recibo.pdf');
    const client = await zipOf('kind=client&batch=all');
    expect(Object.keys(client).some((n) => n.includes('nota.pdf'))).toBe(false); // não reembolsável fora
    expect(Object.keys(client).some((n) => n.includes('recibo.pdf'))).toBe(
      true,
    );
    await api(
      'get',
      `/projects/${project}/expense-board/zip?kind=full&batch=999`,
    ).expect(409);
  });

  it('concluir o financeiro bloqueia alterações até reabrir (com justificativa)', async () => {
    await api('post', `/projects/${project}/finance-closure/close`, user)
      .send({ reason: 'Projeto encerrado' })
      .expect(403);
    await api('post', `/projects/${project}/finance-closure/close`)
      .send({ reason: 'Projeto encerrado' })
      .expect(200);
    expect((await board()).closure).toBeTruthy();
    await create({ field_agent_id: ana, reason_code: 'Transporte' }).expect(
      409,
    );
    await api('post', `/projects/${project}/expense-advances`)
      .send({ field_agent_id: ana, advanced_on: '2026-10-01', amount: '10.00' })
      .expect(409);
    const row = (
      await api('get', '/expense-projects').expect(200)
    ).body.items.find((p: { id: number }) => p.id === project);
    expect(row.finance_closed).toBe(true);
    await api('post', `/projects/${project}/finance-closure/reopen`)
      .send({ reason: 'Faltou uma nota' })
      .expect(200);
    await create({ field_agent_id: ana, reason_code: 'Transporte' }).expect(
      201,
    );
  });

  it('Remuneração usa o tipo real de cada despesa nas não reembolsáveis', async () => {
    const res = (await api('get', '/remuneration/projects').expect(200)).body;
    const row = res.items.find((p: { id: number }) => p.id === project);
    const nonReimb = (await board('?expense_type=non_reimbursable')).totals
      .amount;
    expect(row.non_reimbursable_expenses).toBe(nonReimb);
  });
});
