import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  loginAsOrgAdmin,
  seedTestData,
} from '../test-app.helper';

/**
 * Parâmetros com data passada: sem valor de reserva, a versão pode começar
 * antes da primeira (preenche o período sem parâmetros) ou depois da última,
 * mesmo no passado; a tela recebe a data do lançamento mais antigo.
 */
describe('Parâmetros financeiros retroativos (e2e)', () => {
  let app: INestApplication;
  let admin: string;
  let defaults: Record<string, unknown>;
  const api = (method: 'get' | 'post', path: string) =>
    request(app.getHttpServer())
      [method]('/api/v1' + path)
      .set('Authorization', 'Bearer ' + admin);
  const publish = (valid_from: string) =>
    api('post', '/finance-settings').send({
      valid_from,
      reason: 'Teste de vigencia',
      values: defaults,
    });

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    admin = await loginAsOrgAdmin(app);
    defaults = (await api('get', '/finance-settings/defaults').expect(200))
      .body;
  });
  afterAll(async () => {
    await app?.close();
  });

  it('pedido anterior à primeira versão fica sem líquido, não apaga o total e passa a calcular com a versão retroativa', async () => {
    const project = (
      await api('post', '/projects')
        .send({ organization_id: 1, company_id: 1, name: 'Vigencia' })
        .expect(201)
    ).body.id;
    await publish('2026-11-01').expect(201);
    const order = (cost: string, price: string, ordered_on: string) =>
      api('post', '/asset-tag-orders')
        .send({
          project_id: project,
          ordered_on,
          quantity: 100,
          unit_cost: cost,
          unit_price: price,
          supplier_name: 'Planner',
        })
        .expect(201);
    await order('1.00', '2.00', '2026-10-05'); // sem % vigente
    await order('1.00', '3.00', '2026-11-05'); // líquido 300 × 0,84 = 252; lucro 152
    let list = (await api('get', '/asset-tag-orders').expect(200)).body;
    expect(list.kpis).toMatchObject({
      net_profit: '152.00',
      missing_tax_count: 1,
      missing_tax_since: '2026-10-05',
    });
    expect(list.totals).toMatchObject({
      net_value: '252.00',
      missing_tax_count: 1,
    });

    const overview = (await api('get', '/finance-settings').expect(200)).body;
    expect(overview).toMatchObject({
      earliest_fact_date: '2026-10-05',
      coverage_start: '2026-11-01',
    });

    // entre versões ou na mesma data: recusado; antes da primeira: aceito
    await publish('2026-11-01').expect(409);
    await publish('2026-10-05').expect(201);
    list = (await api('get', '/asset-tag-orders').expect(200)).body;
    // 200 × 0,84 = 168 − 100 = 68; total 152 + 68 = 220
    expect(list.kpis).toMatchObject({
      net_profit: '220.00',
      missing_tax_count: 0,
    });
    await publish('2026-10-20').expect(409); // entre 05/10 e 01/11
  });

  it('depois da última, no passado, é aceito', async () => {
    await publish('2026-11-10').expect(201);
  });
});
