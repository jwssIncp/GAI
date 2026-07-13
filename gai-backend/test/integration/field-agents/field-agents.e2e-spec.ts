import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { FieldAgentAuditLogEntity } from '../../../src/modules/field-agents/infrastructure/persistence/field-agent-audit-log.entity';
import { FieldAgentEntity } from '../../../src/modules/field-agents/infrastructure/persistence/field-agent.entity';
import { ProjectFieldAgentEntity } from '../../../src/modules/field-agents/infrastructure/persistence/project-field-agent.entity';
import { FieldAgentStatus } from '../../../src/modules/field-agents/domain/enums/field-agent-status.enum';
import { OrganizationStatus } from '../../../src/modules/organizations/domain/enums/organization-status.enum';
import { OrganizationEntity } from '../../../src/modules/organizations/infrastructure/persistence/organization.entity';
import {
  createTestApp,
  loginAsOrgUser,
  seedTestData,
} from '../test-app.helper';

interface ProjectBody {
  id: number;
}

interface FieldAgentBody {
  id: number;
  organization_id: number;
  name: string;
  status: string;
}

interface FieldAgentListBody {
  items: FieldAgentBody[];
  total_items: number;
}

interface ProjectFieldAgentBody {
  id: number;
  project_id: number;
  field_agent_id: number;
  status: string;
}

describe('Field Agents API (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeEach(async () => {
    app = await createTestApp();
    await seedTestData(app);
    token = await loginAsOrgUser(app);
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates, lists and audits field agents', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/field-agents')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Maria Inventariante',
        email: 'maria@gai.local',
        document: '529.982.247-25',
        phone: '+55 (11) 99999-8888',
      })
      .expect(201);
    const createdFieldAgent = response.body as FieldAgentBody;

    expect(createdFieldAgent).toMatchObject({
      organization_id: 1,
      name: 'Maria Inventariante',
      status: 'active',
    });
    expect(createdFieldAgent).toMatchObject({
      document: '52998224725',
      phone: '11999998888',
    });

    const list = await request(app.getHttpServer())
      .get('/api/v1/field-agents?page=1&page_size=10')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const listBody = list.body as FieldAgentListBody;

    expect(listBody.total_items).toBe(1);
    expect(listBody.items[0].id).toBe(createdFieldAgent.id);

    const auditRepo = app.get<Repository<FieldAgentAuditLogEntity>>(
      getRepositoryToken(FieldAgentAuditLogEntity),
    );
    await expect(auditRepo.count()).resolves.toBe(1);
  });

  it('assigns and removes a field agent from an operational project', async () => {
    const project = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        organization_id: 1,
        company_id: 1,
        name: 'Inventario 2026',
      })
      .expect(201);
    const projectBody = project.body as ProjectBody;

    const fieldAgent = await request(app.getHttpServer())
      .post('/api/v1/field-agents')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Joao Inventariante',
      })
      .expect(201);
    const fieldAgentBody = fieldAgent.body as FieldAgentBody;

    const assignment = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectBody.id}/field-agents`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        field_agent_id: fieldAgentBody.id,
        role: 'collector',
      })
      .expect(201);
    const assignmentBody = assignment.body as ProjectFieldAgentBody;

    expect(assignmentBody).toMatchObject({
      project_id: projectBody.id,
      field_agent_id: fieldAgentBody.id,
      status: 'active',
    });

    const removed = await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${projectBody.id}/field-agents/${assignmentBody.id}/remove`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const removedBody = removed.body as ProjectFieldAgentBody;

    expect(removedBody.status).toBe('finished');
  });

  it('blocks assignment to finished project', async () => {
    const project = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        organization_id: 1,
        company_id: 1,
        name: 'Inventario fechado',
      })
      .expect(201);
    const projectBody = project.body as ProjectBody;

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectBody.id}/finish`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const fieldAgent = await request(app.getHttpServer())
      .post('/api/v1/field-agents')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Ana Inventariante',
      })
      .expect(201);
    const fieldAgentBody = fieldAgent.body as FieldAgentBody;

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectBody.id}/field-agents`)
      .set('Authorization', `Bearer ${token}`)
      .send({ field_agent_id: fieldAgentBody.id })
      .expect(409);
  });

  it('rejects organization_id supplied by the client', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/field-agents')
      .set('Authorization', `Bearer ${token}`)
      .send({ organization_id: 999, name: 'Tenant adulterado' })
      .expect(400);
  });

  it('prevents reading a field agent from another organization', async () => {
    const orgRepo = app.get<Repository<OrganizationEntity>>(
      getRepositoryToken(OrganizationEntity),
    );
    const agentRepo = app.get<Repository<FieldAgentEntity>>(
      getRepositoryToken(FieldAgentEntity),
    );
    const now = new Date();
    const otherOrg = await orgRepo.save(
      orgRepo.create({
        legalName: 'Outra Organization',
        tradeName: 'Outra',
        cnpj: '45723174000110',
        contactEmail: null,
        contactPhone: null,
        status: OrganizationStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
      }),
    );
    const otherAgent = await agentRepo.save(
      agentRepo.create({
        organizationId: otherOrg.id,
        userId: null,
        name: 'Outro Tenant',
        email: null,
        phone: null,
        document: null,
        status: FieldAgentStatus.ACTIVE,
        metadata: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }),
    );
    await request(app.getHttpServer())
      .get(`/api/v1/field-agents/${otherAgent.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it.each([
    ['invalid CPF', { document: '529.982.247-24' }],
    ['invalid CNPJ', { document: '11.222.333/0001-80' }],
    ['invalid phone', { phone: '11 9999 ramal 2' }],
  ])('rejects %s', async (_label, invalidField) => {
    await request(app.getHttpServer())
      .post('/api/v1/field-agents')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Dado invalido', ...invalidField })
      .expect(400);
  });

  it('returns field-specific 409 for duplicate email and document', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/field-agents')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Primeiro',
        email: ' DUPLICADO@GAI.LOCAL ',
        document: '11222333000181',
      })
      .expect(201);

    const emailConflict = await request(app.getHttpServer())
      .post('/api/v1/field-agents')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Segundo', email: 'duplicado@gai.local' })
      .expect(409);
    expect(emailConflict.body).toMatchObject({
      code: 'CONFLICT',
      details: [{ field: 'email' }],
    });

    const documentConflict = await request(app.getHttpServer())
      .post('/api/v1/field-agents')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Terceiro', document: '11.222.333/0001-81' })
      .expect(409);
    expect(documentConflict.body).toMatchObject({
      code: 'CONFLICT',
      details: [{ field: 'document' }],
    });
  });

  it('blocks, unblocks and soft deletes without exposing deleted records', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/field-agents')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Exclusao Logica' })
      .expect(201);
    const id = (created.body as FieldAgentBody).id;

    await request(app.getHttpServer())
      .post(`/api/v1/field-agents/${id}/block`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const project = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ organization_id: 1, company_id: 1, name: 'Projeto bloqueio' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${(project.body as ProjectBody).id}/field-agents`)
      .set('Authorization', `Bearer ${token}`)
      .send({ field_agent_id: id })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/v1/field-agents/${id}/unblock`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/api/v1/field-agents/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
    await request(app.getHttpServer())
      .get(`/api/v1/field-agents/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    const repo = app.get<Repository<FieldAgentEntity>>(
      getRepositoryToken(FieldAgentEntity),
    );
    const deleted = await repo.findOne({ where: { id }, withDeleted: true });
    expect(deleted?.deletedAt).toBeInstanceOf(Date);
  });

  it('prevents PATCH from reactivating a duplicate assignment atomically', async () => {
    const project = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ organization_id: 1, company_id: 1, name: 'Projeto duplicidade' })
      .expect(201);
    const agentResponse = await request(app.getHttpServer())
      .post('/api/v1/field-agents')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Agente duplicidade' })
      .expect(201);
    const projectId = (project.body as ProjectBody).id;
    const fieldAgentId = (agentResponse.body as FieldAgentBody).id;

    const inactive = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/field-agents`)
      .set('Authorization', `Bearer ${token}`)
      .send({ field_agent_id: fieldAgentId })
      .expect(201);
    const inactiveId = (inactive.body as ProjectFieldAgentBody).id;
    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${projectId}/field-agents/${inactiveId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'inactive' })
      .expect(200);
    const active = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/field-agents`)
      .set('Authorization', `Bearer ${token}`)
      .send({ field_agent_id: fieldAgentId })
      .expect(201);
    const activeId = (active.body as ProjectFieldAgentBody).id;

    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${projectId}/field-agents/${inactiveId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'active' })
      .expect(409);
    const repo = app.get<Repository<ProjectFieldAgentEntity>>(
      getRepositoryToken(ProjectFieldAgentEntity),
    );
    await expect(
      repo.findOneByOrFail({ id: inactiveId }),
    ).resolves.toMatchObject({ status: 'inactive' });
    await expect(repo.findOneByOrFail({ id: activeId })).resolves.toMatchObject(
      { status: 'active' },
    );
  });
});
