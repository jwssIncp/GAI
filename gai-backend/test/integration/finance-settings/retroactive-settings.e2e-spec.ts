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

  /**
   * Corte herdado: a versão nova herda o mês de corte da anterior; o padrão
   * "mês de início" só vale para a 1ª versão. Mudar o corte exige confirmação.
   */
  it('versão nova só com outro IR não altera o corte; mudar o corte exige confirmação', async () => {
    const versions = async () =>
      (await api('get', '/finance-settings').expect(200)).body
        .versions as Array<{
        version: number;
        valid_from: string;
        values: Record<string, unknown>;
      }>;
    const last = (await versions())[0];
    const inherited = last.values.dre_regime_cutoff_month as string;
    // Só o IR muda; o cliente manda os valores padrão (corte = mês de início).
    const onlyTax = {
      ...defaults,
      income_tax_pct: '15.00',
      dre_regime_cutoff_month: '2026-11',
    };
    const created = (
      await api('post', '/finance-settings')
        .send({ valid_from: '2026-11-12', reason: 'Novo IR', values: onlyTax })
        .expect(inherited === '2026-11' ? 201 : 409)
    ).body;
    if (inherited !== '2026-11') {
      // recusado: o corte mudaria sem confirmação, e a resposta diz o impacto
      expect(created).toMatchObject({
        code: 'CUTOFF_CHANGE_NOT_CONFIRMED',
        details: { inherited, requested: '2026-11' },
      });
      expect(created.message).toContain('Confirme a mudança do corte');
    }
    // sem informar o corte: herda o da versão anterior
    const { dre_regime_cutoff_month: _drop, ...noCutoff } = onlyTax;
    void _drop;
    await api('post', '/finance-settings')
      .send({ valid_from: '2026-11-13', reason: 'Novo IR', values: noCutoff })
      .expect(201);
    let v = (await versions())[0];
    expect(v.values).toMatchObject({
      income_tax_pct: '15.00',
      dre_regime_cutoff_month: inherited,
    });
    // corte diferente sem confirmar: 409 com os meses que mudam de regime
    const other = inherited === '2026-12' ? '2026-11' : '2026-12';
    const refused = (
      await api('post', '/finance-settings')
        .send({
          valid_from: '2026-11-14',
          reason: 'Muda o corte',
          values: { ...noCutoff, dre_regime_cutoff_month: other },
        })
        .expect(409)
    ).body;
    expect(refused).toMatchObject({
      code: 'CUTOFF_CHANGE_NOT_CONFIRMED',
      details: { inherited, requested: other },
    });
    expect(refused.details.months.length).toBeGreaterThan(0);
    expect((await versions())[0].version).toBe(v.version);
    // com confirmação explícita: aceito
    await api('post', '/finance-settings')
      .send({
        valid_from: '2026-11-14',
        reason: 'Muda o corte',
        values: { ...noCutoff, dre_regime_cutoff_month: other },
        change_cutoff: true,
      })
      .expect(201);
    v = (await versions())[0];
    expect(v.values.dre_regime_cutoff_month).toBe(other);
  });
});
