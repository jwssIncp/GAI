import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { FieldAgentAuditLogEntity } from '../../../src/modules/field-agents/infrastructure/persistence/field-agent-audit-log.entity';
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
        organization_id: 1,
        name: 'Maria Inventariante',
        email: 'maria@gai.local',
        document: '12345678900',
      })
      .expect(201);
    const createdFieldAgent = response.body as FieldAgentBody;

    expect(createdFieldAgent).toMatchObject({
      organization_id: 1,
      name: 'Maria Inventariante',
      status: 'active',
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
        organization_id: 1,
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
        organization_id: 1,
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
});
