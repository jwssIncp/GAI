import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ContractEntity } from '../../../src/modules/contracts/contract.entity';
import { AssetTagsService } from '../../../src/modules/asset-tags/asset-tags.service';
import { civilToday } from '../../../src/modules/finance-settings/finance-settings.policy';
import {
  createTestApp,
  loginAsOrgAdmin,
  loginAsOrgUser,
  seedTestData,
} from '../test-app.helper';

describe('Placas de patrimônio (e2e, etapa 5)', () => {
  let app: INestApplication;
  let admin: string;
  let user: string;
  let project: number;
  const api = (
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    token = admin,
  ) =>
    request(app.getHttpServer())
      [method]('/api/v1' + path)
      .set('Authorization', 'Bearer ' + token);
  type Row = Record<string, unknown> & { id: number };
  const list = async (query = '') =>
    (await api('get', `/asset-tag-orders${query}`).expect(200)).body as {
      kpis: Record<string, unknown>;
      totals: Record<string, unknown>;
      items: Row[];
      parameters: {
        tag_tax_pct: string | null;
        default_tag_supplier: string | null;
      };
    };

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    admin = await loginAsOrgAdmin(app);
    user = await loginAsOrgUser(app);
    project = (
      await api('post', '/projects')
        .send({ organization_id: 1, company_id: 1, name: 'Placas etapa 5' })
        .expect(201)
    ).body.id;
    // "Plaquetas por conta de: cliente" → reembolsável
    await app
      .get(DataSource)
      .getRepository(ContractEntity)
      .save({
        organizationId: 1,
        projectId: project,
        companyId: 1,
        number: 'CT-E5',
        revision: 1,
        data: {
          status: 'active',
          tags_paid_by: 'client',
          current_value: '50000.00',
          services: [],
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

  it('cria pela sequência (qtd = fim − início + 1) com fornecedor padrão e calcula custo, valor, líquido e lucro', async () => {
    const created = (
      await api('post', '/asset-tag-orders')
        .send({
          project_id: project,
          proposal_number: 'P-100',
          ordered_on: '2026-10-01',
          quantity: 5, // ignorada: a sequência manda
          sequence_start: 1001,
          sequence_end: 2000,
          model: 'Alumínio',
          unit_cost: '0.85',
          unit_price: '2.50',
          supplier_expected_payment_on: '2026-10-20',
          client_expected_receipt_on: '2026-11-30',
        })
        .expect(201)
    ).body;
    const row = (await list()).items.find((i) => i.id === created.id)!;
    expect(row).toMatchObject({
      quantity: 1000,
      quantity_from_sequence: true,
      supplier_name: 'Planner',
      cost_total: '850.00',
      value_total: '2500.00',
      tax_pct: '16.00',
      net_value: '2100.00',
      net_profit: '1250.00',
      expense_type: 'reimbursable',
      expense_type_source: 'contract',
      supplier_payment_status: 'pending',
      client_received: false,
    });
  });

  it('recusa sequência invertida, modelo fora da lista e falta de quantidade', async () => {
    const base = {
      project_id: project,
      ordered_on: '2026-10-02',
      unit_cost: '1.00',
      unit_price: '2.00',
    };
    await api('post', '/asset-tag-orders')
      .send({ ...base, sequence_start: 50, sequence_end: 10 })
      .expect(400);
    await api('post', '/asset-tag-orders')
      .send({ ...base, quantity: 10, model: 'Madeira' })
      .expect(400);
    await api('post', '/asset-tag-orders').send(base).expect(400);
  });

  it('edição em linha: tipo manual prevalece, pago sem data = hoje, recebido com data, ano com 2 dígitos', async () => {
    const id = (
      await api('post', '/asset-tag-orders')
        .send({
          project_id: project,
          ordered_on: '0026-10-05',
          quantity: 200,
          unit_cost: '3.00',
          unit_price: '3.00',
        })
        .expect(201)
    ).body.id as number;
    let row = (await list()).items.find((i) => i.id === id)!;
    expect(row.ordered_on).toBe('2026-10-05');
    const changed = (
      await api('patch', `/asset-tag-orders/${id}`)
        .send({ expense_type_override: 'non_reimbursable' })
        .expect(200)
    ).body;
    expect(changed.changed).toEqual(['Tipo de despesa']);
    await api('patch', `/asset-tag-orders/${id}`)
      .send({ supplier_paid: true })
      .expect(200);
    await api('patch', `/asset-tag-orders/${id}`)
      .send({ client_received_on: '0026-11-02' })
      .expect(200);
    row = (await list()).items.find((i) => i.id === id)!;
    expect(row).toMatchObject({
      expense_type: 'non_reimbursable',
      expense_type_source: 'manual',
      supplier_payment_status: 'paid',
      supplier_paid_on: civilToday(),
      client_received: true,
      client_received_on: '2026-11-02',
      net_profit: '-96.00', // 600 × 0,84 = 504 − 600
    });
    await api('patch', `/asset-tag-orders/${id}`)
      .send({ client_received: false })
      .expect(200);
    expect(
      (await list()).items.find((i) => i.id === id)!.client_received_on,
    ).toBeNull();
  });

  it('KPIs e filtros (fornecedor, recebido, tipo, proposta)', async () => {
    const all = await list(`?project_id=${project}`);
    expect(all.kpis).toMatchObject({
      purchased: 1200,
      supplier_pending: 1000,
      to_receive: 1200,
      cost_total: '1450.00',
      value_total: '3100.00',
      net_profit: '1154.00', // 1.250 − 96
    });
    expect(
      (await list('?supplier_status=paid')).items.every(
        (i) => i.supplier_payment_status === 'paid',
      ),
    ).toBe(true);
    expect((await list('?expense_type=non_reimbursable')).items).toHaveLength(
      1,
    );
    expect(
      (await list('?proposal=p-1')).items.map((i) => i.proposal_number),
    ).toEqual(['P-100']);
  });

  it('eventos para fluxo de caixa e DRE (linha Etiquetas), sem gravar nada', async () => {
    const events = await app.get(AssetTagsService).events(1);
    const p100 = events.filter((e) => e.description.includes('P-100'));
    expect(p100).toEqual([
      expect.objectContaining({
        direction: 'outflow',
        date: '2026-10-20',
        realized: false,
        amount: '850.00',
        dre_line: 'tags',
      }),
      expect.objectContaining({
        direction: 'inflow',
        date: '2026-11-30',
        realized: false,
        amount: '2100.00',
        dre_line: 'tags',
      }),
    ]);
  });

  it('excluir e permissões', async () => {
    await api('get', '/asset-tag-orders', user).expect(403);
    const { items } = await list();
    await api('delete', `/asset-tag-orders/${items[0].id}`).expect(200);
    expect(
      (await list()).items.find((i) => i.id === items[0].id),
    ).toBeUndefined();
  });
});
