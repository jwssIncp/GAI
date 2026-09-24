import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { PlateEvidenceSource } from '../../../src/modules/inventory-operations/domain/inventory-operation.enums';
import { InventoryPlateHistoryEntity } from '../../../src/modules/inventory-operations/infrastructure/persistence/inventory-operation.entity';
import {
  createTestApp,
  loginAsAdmin,
  loginAsOrgAdmin,
  loginAsOrgUser,
  seedTestData,
} from '../test-app.helper';

describe('Inventory operation gap closure (e2e)', () => {
  let app: INestApplication;
  let orgAdminToken: string;
  let platformAdminToken: string;
  let orgUserToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    [orgAdminToken, platformAdminToken, orgUserToken] = await Promise.all([
      loginAsOrgAdmin(app),
      loginAsAdmin(app),
      loginAsOrgUser(app),
    ]);
  });

  afterAll(async () => app.close());

  const auth = (token = orgAdminToken) => ({
    Authorization: `Bearer ${token}`,
  });

  async function createOperation(name: string) {
    const project = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set(auth())
      .send({ organization_id: 1, company_id: 1, name })
      .expect(201);
    const agent = await request(app.getHttpServer())
      .post('/api/v1/field-agents')
      .set(auth())
      .send({ name: `${name} agent` })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.body.id}/field-agents`)
      .set(auth())
      .send({ field_agent_id: agent.body.id })
      .expect(201);
    const item = await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.body.id}/inventory-items`)
      .set(auth())
      .send({ description: `${name} item`, old_plate: 'MASTER-001' })
      .expect(201);
    const session = await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.body.id}/inventory-sessions`)
      .set(auth())
      .send({ name: `${name} session` })
      .expect(201);
    const started = await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${project.body.id}/inventory-sessions/${session.body.id}/start`,
      )
      .set(auth())
      .expect(200);
    return { project, agent, item, session, initialRound: started.body.round };
  }

  it('resumes after refresh, preserves reinventory lineage and closes the lifecycle', async () => {
    const context = await createOperation('Refresh recovery');
    const base = `/api/v1/projects/${context.project.body.id}/inventory-sessions/${context.session.body.id}`;

    await request(app.getHttpServer())
      .get(base)
      .set(auth())
      .expect(200)
      .expect((response) =>
        expect(response.body.current_round_id).toBe(context.initialRound.id),
      );

    await request(app.getHttpServer())
      .get(`${base}/rounds?status=active&type=initial`)
      .set(auth())
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          page: 1,
          page_size: 20,
          total_items: 1,
          total_pages: 1,
        });
        expect(response.body.items[0]).toMatchObject({
          id: context.initialRound.id,
          kind: 'initial',
          type: 'initial',
          status: 'active',
        });
        expect(response.body.items[0].created_at).toBeTruthy();
      });

    const first = await request(app.getHttpServer())
      .post(`${base}/rounds/${context.initialRound.id}/observations`)
      .set(auth())
      .send({
        inventory_item_id: context.item.body.id,
        field_agent_id: context.agent.body.id,
        idempotency_key: 'refresh-observation-0001',
        result: 'divergent',
        observed_plate: 'FIELD-001',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`${base}/rounds/${context.initialRound.id}/observations`)
      .set(auth())
      .send({
        inventory_item_id: context.item.body.id,
        field_agent_id: context.agent.body.id,
        idempotency_key: 'refresh-observation-duplicate',
        result: 'found',
      })
      .expect(409)
      .expect((response) =>
        expect(response.body.code).toBe('OBSERVATION_ALREADY_RECORDED'),
      );

    const evidenceUpload = await request(app.getHttpServer())
      .post(
        `${base}/rounds/${context.initialRound.id}/observations/${first.body.id}/evidence/upload-url`,
      )
      .set(auth())
      .send({
        original_name: 'placa frente.webp',
        mime_type: 'image/webp',
        size_bytes: 4096,
        checksum: 'checksum-1',
      })
      .expect(201);
    expect(evidenceUpload.body.upload_url).toContain('X-GAI-Method=PUT');
    expect(evidenceUpload.body.evidence).toMatchObject({
      observation_id: first.body.id,
      session_id: context.session.body.id,
      round_id: context.initialRound.id,
      status: 'pending_upload',
    });

    const evidenceBase = `${base}/rounds/${context.initialRound.id}/observations/${first.body.id}/evidence`;
    await request(app.getHttpServer())
      .post(`${evidenceBase}/${evidenceUpload.body.evidence.id}/download-url`)
      .set(auth())
      .expect(409)
      .expect((response) =>
        expect(response.body.code).toBe('OBSERVATION_EVIDENCE_NOT_UPLOADED'),
      );
    await request(app.getHttpServer())
      .post(`${evidenceBase}/${evidenceUpload.body.evidence.id}/confirm-upload`)
      .set(auth())
      .send({ checksum: 'checksum-1', size_bytes: 4096 })
      .expect(200)
      .expect((response) => expect(response.body.status).toBe('uploaded'));
    await request(app.getHttpServer())
      .get(evidenceBase)
      .set(auth())
      .expect(200)
      .expect((response) => {
        expect(response.body.total_items).toBe(1);
        expect(response.body.items[0].storage_key).toContain(
          `/observations/${first.body.id}/evidence/`,
        );
      });
    await request(app.getHttpServer())
      .post(`${evidenceBase}/${evidenceUpload.body.evidence.id}/download-url`)
      .set(auth())
      .expect(200)
      .expect((response) =>
        expect(response.body.download_url).toContain('X-GAI-Method=GET'),
      );

    const reinventory = await request(app.getHttpServer())
      .post(`${base}/reinventory`)
      .set(auth())
      .send({
        inventory_item_id: context.item.body.id,
        reason: 'Confirmar leitura depois do restart',
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(base)
      .set(auth())
      .expect(200)
      .expect((response) =>
        expect(response.body.current_round_id).toBe(reinventory.body.id),
      );
    await request(app.getHttpServer())
      .get(`${base}/rounds?status=active&type=reinventory`)
      .set(auth())
      .expect(200)
      .expect((response) =>
        expect(response.body.items[0].id).toBe(reinventory.body.id),
      );

    await request(app.getHttpServer())
      .post(`${base}/rounds/${reinventory.body.id}/observations`)
      .set(auth())
      .send({
        inventory_item_id: context.item.body.id,
        field_agent_id: context.agent.body.id,
        idempotency_key: 'refresh-observation-0001',
        result: 'found',
      })
      .expect(409)
      .expect((response) =>
        expect(response.body.code).toBe('IDEMPOTENCY_KEY_REUSED'),
      );
    const second = await request(app.getHttpServer())
      .post(`${base}/rounds/${reinventory.body.id}/observations`)
      .set(auth())
      .send({
        inventory_item_id: context.item.body.id,
        field_agent_id: context.agent.body.id,
        idempotency_key: 'refresh-observation-0002',
        result: 'found',
        observed_plate: 'FIELD-002',
      })
      .expect(201);
    expect(second.body.prior_observation_id).toBe(first.body.id);

    await request(app.getHttpServer())
      .get(
        `/api/v1/projects/${context.project.body.id}/inventory-items/${context.item.body.id}/plate-history`,
      )
      .set(auth())
      .expect(200)
      .expect((response) => {
        expect(response.body.items).toHaveLength(2);
        expect(response.body.items[0]).toMatchObject({
          observation_id: first.body.id,
          session_id: context.session.body.id,
          round_id: context.initialRound.id,
          round_number: 1,
          field_agent_id: context.agent.body.id,
        });
        expect(response.body.items[0].captured_at).toBeTruthy();
      });
    const plateHistory = app.get(
      getRepositoryToken(InventoryPlateHistoryEntity),
    );
    await plateHistory.save({
      organizationId: 1,
      projectId: context.project.body.id,
      inventoryItemId: context.item.body.id,
      observationId: null,
      previousPlate: 'FIELD002',
      observedPlate: 'MANUAL003',
      source: PlateEvidenceSource.MANUAL,
      recordedById: null,
    });
    await request(app.getHttpServer())
      .get(
        `/api/v1/projects/${context.project.body.id}/inventory-items/${context.item.body.id}/plate-history`,
      )
      .set(auth())
      .expect(200)
      .expect((response) => {
        const manual = response.body.items.find(
          (row: { source: string }) => row.source === 'manual',
        );
        expect(manual).toMatchObject({
          observation_id: null,
          session_id: null,
          round_id: null,
          round_number: null,
        });
      });

    await request(app.getHttpServer())
      .post(`${base}/finish`)
      .set(auth())
      .expect(409)
      .expect((response) =>
        expect(response.body.code).toBe('INVENTORY_SESSION_HAS_ACTIVE_ROUNDS'),
      );
    for (const roundId of [context.initialRound.id, reinventory.body.id]) {
      await request(app.getHttpServer())
        .post(`${base}/rounds/${roundId}/finish`)
        .set(auth())
        .expect(200);
    }
    await request(app.getHttpServer())
      .post(`${base}/finish`)
      .set(auth())
      .expect(200)
      .expect((response) => expect(response.body.status).toBe('finished'));
    await request(app.getHttpServer())
      .post(`${base}/finish`)
      .set(auth())
      .expect(409);
    await request(app.getHttpServer())
      .post(`${base}/cancel`)
      .set(auth())
      .send({ reason: 'invalid transition' })
      .expect(409);
    await request(app.getHttpServer())
      .post(`${base}/reinventory`)
      .set(auth())
      .send({
        inventory_item_id: context.item.body.id,
        reason: 'invalid after finish',
      })
      .expect(409);
    await request(app.getHttpServer())
      .post(`${base}/rounds/${reinventory.body.id}/observations`)
      .set(auth())
      .send({
        inventory_item_id: context.item.body.id,
        field_agent_id: context.agent.body.id,
        idempotency_key: 'refresh-observation-after-finish',
        result: 'found',
      })
      .expect(409);
    await request(app.getHttpServer())
      .post(`${evidenceBase}/upload-url`)
      .set(auth())
      .send({
        original_name: 'late.jpg',
        mime_type: 'image/jpeg',
        size_bytes: 100,
      })
      .expect(409)
      .expect((response) =>
        expect(response.body.code).toBe('INVENTORY_SESSION_NOT_ACTIVE'),
      );
  });

  it('cancels an active session and all of its active rounds without deletion', async () => {
    const context = await createOperation('Cancellation');
    const base = `/api/v1/projects/${context.project.body.id}/inventory-sessions/${context.session.body.id}`;
    await request(app.getHttpServer())
      .post(`${base}/cancel`)
      .set(auth())
      .send({ reason: 'Operacao interrompida pelo responsavel' })
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          status: 'cancelled',
          cancellation_reason: 'Operacao interrompida pelo responsavel',
        }),
      );
    await request(app.getHttpServer())
      .get(`${base}/rounds?status=cancelled`)
      .set(auth())
      .expect(200)
      .expect((response) => {
        expect(response.body.total_items).toBe(1);
        expect(response.body.items[0].status).toBe('cancelled');
      });
    await request(app.getHttpServer())
      .post(`${base}/start`)
      .set(auth())
      .expect(409);
    const draft = await request(app.getHttpServer())
      .post(`/api/v1/projects/${context.project.body.id}/inventory-sessions`)
      .set(auth())
      .send({ name: 'Draft cancellation' })
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${context.project.body.id}/inventory-sessions/${draft.body.id}/cancel`,
      )
      .set(auth())
      .send({ reason: 'Cancel before start' })
      .expect(200)
      .expect((response) => expect(response.body.status).toBe('cancelled'));
  });

  it('enforces authentication, permission, project and organization scope', async () => {
    const context = await createOperation('Authorization');
    const roundsUrl = `/api/v1/projects/${context.project.body.id}/inventory-sessions/${context.session.body.id}/rounds`;
    await request(app.getHttpServer()).get(roundsUrl).expect(401);
    await request(app.getHttpServer())
      .get(roundsUrl)
      .set(auth(orgUserToken))
      .expect(403);
    const evidenceUrl = `/api/v1/projects/${context.project.body.id}/inventory-sessions/${context.session.body.id}/rounds/${context.initialRound.id}/observations/999/evidence`;
    await request(app.getHttpServer()).get(evidenceUrl).expect(401);
    await request(app.getHttpServer())
      .get(evidenceUrl)
      .set(auth(orgUserToken))
      .expect(403);
    await request(app.getHttpServer()).get(evidenceUrl).set(auth()).expect(404);

    const otherOrganization = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set(auth(platformAdminToken))
      .send({
        legal_name: 'Outra organizacao de inventario',
        cnpj: '11444777000161',
      })
      .expect(201);
    const otherCompany = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set(auth(platformAdminToken))
      .send({
        organization_id: otherOrganization.body.id,
        name: 'Outra companhia',
        corporate_name: 'Outra Companhia LTDA',
        document: '11444777000161',
      })
      .expect(201);
    const otherProject = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set(auth(platformAdminToken))
      .send({
        organization_id: otherOrganization.body.id,
        company_id: otherCompany.body.id,
        name: 'Projeto de outro tenant',
      })
      .expect(201);
    await request(app.getHttpServer())
      .get(
        `/api/v1/projects/${otherProject.body.id}/inventory-sessions/999/rounds`,
      )
      .set(auth())
      .expect(403);
    await request(app.getHttpServer())
      .get(
        `/api/v1/projects/${otherProject.body.id}/inventory-sessions/999/rounds/999/observations/999/evidence`,
      )
      .set(auth())
      .expect(403);

    const otherProjectSameTenant = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set(auth())
      .send({
        organization_id: 1,
        company_id: 1,
        name: 'Outro projeto mesmo tenant',
      })
      .expect(201);
    await request(app.getHttpServer())
      .get(
        `/api/v1/projects/${otherProjectSameTenant.body.id}/inventory-sessions/${context.session.body.id}/rounds/${context.initialRound.id}/observations/999/evidence`,
      )
      .set(auth())
      .expect(404);
  });
});
