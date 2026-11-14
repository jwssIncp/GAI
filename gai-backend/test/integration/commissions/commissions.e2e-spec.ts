import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ContractEntity } from '../../../src/modules/contracts/contract.entity';
import { CommissionsService } from '../../../src/modules/commissions/commissions.service';
import {
  createTestApp,
  loginAsOrgAdmin,
  loginAsOrgUser,
  seedTestData,
} from '../test-app.helper';

describe('Comissões e parceiros (e2e, etapa 6)', () => {
  let app: INestApplication;
  let admin: string;
  let user: string;
  let alfa: number;
  let beta: number;
  let ana: number;
  const api = (
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    token = admin,
  ) =>
    request(app.getHttpServer())
      [method]('/api/v1' + path)
      .set('Authorization', 'Bearer ' + token);
  type Row = Record<string, unknown> & {
    id: number;
    status: string;
    amount: string;
  };
  const list = async (query = '') =>
    (await api('get', `/commissions${query}`).expect(200)).body as {
      kpis: Record<string, unknown>;
      items: Row[];
      projects: Array<{ id: number; contract_value: string | null }>;
    };

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    admin = await loginAsOrgAdmin(app);
    user = await loginAsOrgUser(app);
    const project = async (name: string, value: string) => {
      const id = (
        await api('post', '/projects')
          .send({ organization_id: 1, company_id: 1, name })
          .expect(201)
      ).body.id as number;
      await app
        .get(DataSource)
        .getRepository(ContractEntity)
        .save({
          organizationId: 1,
          projectId: id,
          companyId: 1,
          number: `CT-${name}`,
          revision: 1,
          data: {
            status: 'active',
            current_value: value,
            services: [],
          } as never,
        });
      return id;
    };
    alfa = await project('Alfa comissoes', '100000.00');
    beta = await project('Beta comissoes', '85350.00');
  });
  afterAll(async () => {
    await app?.close();
  });

  it('parceiros: cadastro sem duplicar (acento e caixa), exclusão e restauração', async () => {
    ana = (
      await api('post', '/commission-partners')
        .send({ name: 'Ana Parceira', company: 'Ação Ltda' })
        .expect(201)
    ).body.id;
    const dup = await api('post', '/commission-partners')
      .send({ name: 'ana  parceira', company: 'ACAO LTDA' })
      .expect(409);
    expect(dup.body).toMatchObject({
      code: 'PARTNER_DUPLICATED',
    });
    await api('post', '/commission-partners')
      .send({ name: 'Ana Parceira', company: 'Outra' })
      .expect(201);
    await api('post', '/commission-partners', user)
      .send({ name: 'Sem permissão' })
      .expect(403);
  });

  it('lança com o valor do contrato vindo do projeto e comissão = valor × % / 100', async () => {
    const id = (
      await api('post', '/commissions')
        .send({
          project_id: alfa,
          partner_id: ana,
          percent: '4.00',
          expected_payment_on: '2026-12-10',
        })
        .expect(201)
    ).body.id;
    const row = (await list()).items.find((r) => r.id === id)!;
    expect(row).toMatchObject({
      contract_value: '100000.00',
      amount: '4000.00',
      calculated_amount: '4000.00',
      amount_manual: null,
      partner_name: 'Ana Parceira (Ação Ltda)',
      status: 'pending',
    });
  });

  it('valor manual prevalece e pode ser apagado; trocar o contrato atualiza o valor', async () => {
    const id = (await list()).items[0].id;
    expect(
      (
        await api('patch', `/commissions/${id}`)
          .send({ amount_manual: '3500.00' })
          .expect(200)
      ).body.changed,
    ).toEqual(['Valor da comissão']);
    expect((await list()).items[0].amount).toBe('3500.00');
    await api('patch', `/commissions/${id}`)
      .send({ amount_manual: null })
      .expect(200);
    expect((await list()).items[0].amount).toBe('4000.00');
    await api('patch', `/commissions/${id}`)
      .send({ project_id: beta, percent: '6.00' })
      .expect(200);
    expect((await list()).items[0]).toMatchObject({
      contract_value: '85350.00',
      amount: '5121.00',
    });
  });

  it('status automático, KPIs em R$ (atrasadas) e ordem pela data prevista', async () => {
    await api('post', '/commissions')
      .send({
        project_id: alfa,
        partner_id: ana,
        percent: '8.00',
        expected_payment_on: '2026-01-15',
      })
      .expect(201); // atrasada
    await api('post', '/commissions')
      .send({
        project_id: alfa,
        partner_id: ana,
        percent: '2.00',
        expected_payment_on: '2026-02-01',
        paid_on: '0026-02-03',
      })
      .expect(201); // paga (ano corrigido)
    const data = await list();
    expect(data.items.map((r) => r.status)).toEqual([
      'overdue',
      'paid',
      'pending',
    ]);
    expect(data.items[1]).toMatchObject({ paid_on: '2026-02-03' });
    expect(data.kpis).toEqual({
      total: '15121.00',
      paid: '2000.00',
      pending: '5121.00',
      overdue: '8000.00',
      overdue_count: 1,
    });
    expect((await list('?status=overdue')).items).toHaveLength(1);
    expect((await list(`?project_id=${alfa}`)).items).toHaveLength(2);
  });

  it('excluir o parceiro mantém o nome nas comissões lançadas', async () => {
    await api('delete', `/commission-partners/${ana}`).expect(200);
    const partners = (await api('get', '/commission-partners').expect(200))
      .body as Array<{ id: number }>;
    expect(partners.some((p) => p.id === ana)).toBe(false);
    expect(
      (await list()).items.every(
        (r) => r.partner_name === 'Ana Parceira (Ação Ltda)',
      ),
    ).toBe(true);
    // re-cadastrar o mesmo parceiro restaura o registro (não duplica)
    expect(
      (
        await api('post', '/commission-partners')
          .send({ name: 'ANA PARCEIRA', company: 'Ação Ltda' })
          .expect(201)
      ).body.id,
    ).toBe(ana);
  });

  it('eventos para fluxo de caixa e DRE (Comissão Comercial), sem gravar nada', async () => {
    const events = await app.get(CommissionsService).events(1);
    expect(events).toHaveLength(3);
    expect(events.find((e) => e.realized)).toMatchObject({
      direction: 'outflow',
      date: '2026-02-03',
      amount: '2000.00',
      dre_line: 'commercial_commission',
    });
    expect(events.find((e) => e.amount === '8000.00')).toMatchObject({
      date: '2026-01-15',
      realized: false,
    });
  });

  it('permissões e exclusão', async () => {
    await api('get', '/commissions', user).expect(403);
    const id = (await list()).items[0].id;
    await api('delete', `/commissions/${id}`).expect(200);
    expect((await list()).items).toHaveLength(2);
  });
});
