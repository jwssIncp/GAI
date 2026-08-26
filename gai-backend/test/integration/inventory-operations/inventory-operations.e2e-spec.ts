import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  loginAsOrgAdmin,
  loginAsOrgUser,
  seedTestData,
} from '../test-app.helper';

describe('Inventory operations and accountabilities (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let userToken: string;
  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    token = await loginAsOrgAdmin(app);
    userToken = await loginAsOrgUser(app);
  });
  afterAll(async () => app.close());
  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('enforces authentication and module permissions', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/projects/1/inventory-sessions')
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/projects/1/inventory-sessions')
      .set({ Authorization: `Bearer ${userToken}` })
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/projects/1/expense-accountabilities')
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/projects/1/expense-accountabilities')
      .set({ Authorization: `Bearer ${userToken}` })
      .expect(403);
  });

  it('preserves initial evidence when requesting and recording a reinventory', async () => {
    const project = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set(auth())
      .send({ organization_id: 1, company_id: 1, name: 'Operacao historica' })
      .expect(201);
    const agent = await request(app.getHttpServer())
      .post('/api/v1/field-agents')
      .set(auth())
      .send({ name: 'Inventariante historico' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.body.id}/field-agents`)
      .set(auth())
      .send({ field_agent_id: agent.body.id })
      .expect(201);
    const item = await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.body.id}/inventory-items`)
      .set(auth())
      .send({ description: 'Notebook', old_plate: 'OLD-001' })
      .expect(201);
    const session = await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.body.id}/inventory-sessions`)
      .set(auth())
      .send({ name: 'Campanha 1' })
      .expect(201);
    const started = await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${project.body.id}/inventory-sessions/${session.body.id}/start`,
      )
      .set(auth())
      .expect(200);
    const first = await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${project.body.id}/inventory-sessions/${session.body.id}/rounds/${started.body.round.id}/observations`,
      )
      .set(auth())
      .send({
        inventory_item_id: item.body.id,
        field_agent_id: agent.body.id,
        idempotency_key: 'mobile-observation-0001',
        result: 'divergent',
        observed_plate: 'NEW-001',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${project.body.id}/inventory-sessions/${session.body.id}/rounds/${started.body.round.id}/observations`,
      )
      .set(auth())
      .send({
        inventory_item_id: item.body.id,
        field_agent_id: agent.body.id,
        idempotency_key: 'mobile-observation-0001',
        result: 'divergent',
        observed_plate: 'NEW-001',
      })
      .expect(201)
      .expect((response) => expect(response.body.id).toBe(first.body.id));
    const reinventory = await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${project.body.id}/inventory-sessions/${session.body.id}/reinventory`,
      )
      .set(auth())
      .send({
        inventory_item_id: item.body.id,
        reason: 'Confirmar placa divergente',
      })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${project.body.id}/inventory-sessions/${session.body.id}/rounds/${reinventory.body.id}/observations`,
      )
      .set(auth())
      .send({
        inventory_item_id: item.body.id,
        field_agent_id: agent.body.id,
        idempotency_key: 'mobile-observation-0002',
        result: 'found',
        observed_plate: 'NEW-001',
      })
      .expect(201);
    expect(second.body.prior_observation_id).toBe(first.body.id);
    const secondReinventory = await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${project.body.id}/inventory-sessions/${session.body.id}/reinventory`,
      )
      .set(auth())
      .send({ inventory_item_id: item.body.id, reason: 'Terceira leitura' })
      .expect(201);
    const third = await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${project.body.id}/inventory-sessions/${session.body.id}/rounds/${secondReinventory.body.id}/observations`,
      )
      .set(auth())
      .send({
        inventory_item_id: item.body.id,
        field_agent_id: agent.body.id,
        idempotency_key: 'mobile-observation-0003',
        result: 'divergent',
        observed_plate: 'THIRD-001',
      })
      .expect(201);
    expect(third.body.prior_observation_id).toBe(second.body.id);
    await request(app.getHttpServer())
      .get(
        `/api/v1/projects/${project.body.id}/inventory-sessions/${session.body.id}/observations`,
      )
      .set(auth())
      .expect(200)
      .expect((response) => {
        expect(response.body.items).toHaveLength(3);
        expect(response.body.total_items).toBe(3);
      });
    await request(app.getHttpServer())
      .get(
        `/api/v1/projects/${project.body.id}/inventory-items/${item.body.id}/plate-history`,
      )
      .set(auth())
      .expect(200)
      .expect((response) => {
        expect(response.body.items[0].previous_plate).toBe('OLD001');
        expect(
          response.body.items.map(
            (row: { observed_plate: string }) => row.observed_plate,
          ),
        ).toEqual(['NEW001', 'NEW001', 'THIRD001']);
      });
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${project.body.id}/dashboard`)
      .set(auth())
      .expect(200)
      .expect((response) => {
        expect(response.body.inventory).toMatchObject({
          inventoried_items: 1,
          observations: 3,
          inventory_sessions: 1,
          inventory_rounds: 3,
          reinventory_rounds: 2,
        });
      });
  });

  it('closes an accountability with server-calculated total and exact installments', async () => {
    const project = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set(auth())
      .send({ organization_id: 1, company_id: 1, name: 'Prestacao segura' })
      .expect(201);
    const agent = await request(app.getHttpServer())
      .post('/api/v1/field-agents')
      .set(auth())
      .send({ name: 'Inventariante financeiro' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.body.id}/field-agents`)
      .set(auth())
      .send({ field_agent_id: agent.body.id })
      .expect(201);
    const expense = await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.body.id}/expenses`)
      .set(auth())
      .send({
        field_agent_id: agent.body.id,
        description: 'Hospedagem',
        expense_date: '2026-08-01',
        amount: '100.00',
      })
      .expect(201);
    const accountability = await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.body.id}/expense-accountabilities`)
      .set(auth())
      .send({
        field_agent_id: agent.body.id,
        period_start: '2026-08-01',
        period_end: '2026-08-31',
      })
      .expect(201);
    const otherProject = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set(auth())
      .send({
        organization_id: 1,
        company_id: 1,
        name: 'Projeto de outra despesa',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${otherProject.body.id}/field-agents`)
      .set(auth())
      .send({ field_agent_id: agent.body.id })
      .expect(201);
    const otherExpense = await request(app.getHttpServer())
      .post(`/api/v1/projects/${otherProject.body.id}/expenses`)
      .set(auth())
      .send({
        field_agent_id: agent.body.id,
        description: 'Despesa projeto B',
        expense_date: '2026-08-01',
        amount: '5.00',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${project.body.id}/expense-accountabilities/${accountability.body.id}/expenses`,
      )
      .set(auth())
      .send({ expense_id: otherExpense.body.id })
      .expect(404);
    await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${project.body.id}/expense-accountabilities/${accountability.body.id}/expenses`,
      )
      .set(auth())
      .send({ expense_id: expense.body.id })
      .expect((response) => {
        if (response.status !== 200)
          throw new Error(
            `add expense failed: ${JSON.stringify(response.body)}`,
          );
      });
    await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${project.body.id}/expense-accountabilities/${accountability.body.id}/close`,
      )
      .set(auth())
      .expect(200)
      .expect((response) => expect(response.body.total_amount).toBe('100.00'));
    await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${project.body.id}/expenses/${expense.body.id}/installments/generate`,
      )
      .set(auth())
      .send({
        count: 3,
        first_due_date: '2026-09-01',
        origin: 'Compra a prazo',
      })
      .expect(201)
      .expect((response) =>
        expect(
          response.body.map((row: { amount: string }) => row.amount),
        ).toEqual(['33.34', '33.33', '33.33']),
      );
  });

  it('materializes a physical-base payload idempotently without changing the master plate', async () => {
    const project = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set(auth())
      .send({ organization_id: 1, company_id: 1, name: 'Importacao fisica' })
      .expect(201);
    const agent = await request(app.getHttpServer())
      .post('/api/v1/field-agents')
      .set(auth())
      .send({ name: 'Inventariante importacao' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.body.id}/field-agents`)
      .set(auth())
      .send({ field_agent_id: agent.body.id })
      .expect(201);
    const item = await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.body.id}/inventory-items`)
      .set(auth())
      .send({ description: 'Ativo importado', old_plate: 'ABC001' })
      .expect(201);
    const operationSession = await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.body.id}/inventory-sessions`)
      .set(auth())
      .send({ name: 'Campanha importada' })
      .expect(201);
    const started = await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${project.body.id}/inventory-sessions/${operationSession.body.id}/start`,
      )
      .set(auth())
      .expect(200);
    const importSession = await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.body.id}/import-sessions`)
      .set(auth())
      .send({
        type: 'physical_observations_import',
        source: 'migration',
        metadata: {
          inventory_session_id: operationSession.body.id,
          round_id: started.body.round.id,
          field_agent_id: agent.body.id,
        },
      })
      .expect(201);
    const payload = {
      payload_number: 1,
      idempotency_key: 'physical-base-payload-1',
      items: [
        {
          operation: 'upsert',
          inventory_item_id: item.body.id,
          observed_plate: 'ABC002',
          observation_result: 'divergent',
        },
      ],
    };
    await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${project.body.id}/import-sessions/${importSession.body.id}/payloads`,
      )
      .set(auth())
      .send(payload)
      .expect(201)
      .expect((response) => {
        expect(response.body.created_count).toBe(1);
        expect(response.body.failed_count).toBe(0);
      });
    await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${project.body.id}/import-sessions/${importSession.body.id}/payloads`,
      )
      .set(auth())
      .send(payload)
      .expect(201);
    await request(app.getHttpServer())
      .get(
        `/api/v1/projects/${project.body.id}/inventory-sessions/${operationSession.body.id}/observations`,
      )
      .set(auth())
      .expect(200)
      .expect((response) => expect(response.body.total_items).toBe(1));
    await request(app.getHttpServer())
      .get(
        `/api/v1/projects/${project.body.id}/inventory-items/${item.body.id}/plate-history`,
      )
      .set(auth())
      .expect(200)
      .expect((response) =>
        expect(response.body.items[0]).toMatchObject({
          previous_plate: 'ABC001',
          observed_plate: 'ABC002',
          source: 'physical_base',
        }),
      );
    await request(app.getHttpServer())
      .get(
        `/api/v1/projects/${project.body.id}/inventory-items/${item.body.id}`,
      )
      .set(auth())
      .expect(200)
      .expect((response) => expect(response.body.old_plate).toBe('ABC001'));
  });
});
