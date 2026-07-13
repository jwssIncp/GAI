import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { InventoryItemStatus } from '../../../src/modules/inventory-items/domain/enums/inventory-item-status.enum';
import { InventoryItemEntity } from '../../../src/modules/inventory-items/infrastructure/persistence/inventory-item.entity';
import { ProjectAuditOperation } from '../../../src/modules/projects/domain/enums/project-audit-operation.enum';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from '../../../src/modules/projects/domain/ports/project.repository.port';
import { ProjectAuditLogEntity } from '../../../src/modules/projects/infrastructure/persistence/project-audit-log.entity';
import {
  createTestApp,
  loginAsOrgAdmin,
  loginAsOrgUser,
  seedTestData,
} from '../test-app.helper';

interface ProjectResponseBody {
  id: number;
  organization_id: number;
  company_id: number | null;
  name: string;
  status: string;
  created_by_id: number | null;
  finished_at: string | null;
  available_actions: Array<{ action: string; permission: string }>;
}

interface ProjectListResponseBody {
  items: ProjectResponseBody[];
  page: number;
  page_size: number;
  total_items: number;
}

interface ProjectErrorResponseBody {
  code: string;
  details?: {
    operations?: Array<{ type: string; count: number }>;
  };
}

describe('Projects (e2e)', () => {
  let app: INestApplication;
  let orgAdminToken: string;
  let orgUserToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    orgAdminToken = await loginAsOrgAdmin(app);
    orgUserToken = await loginAsOrgUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates, lists, updates and finishes a project inside the organization scope', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({
        organization_id: 1,
        company_id: 1,
        name: 'Inventario Matriz',
        description: 'Primeiro inventario operacional',
        start_date: '2026-07-07',
        end_date: '2026-07-31',
        settings: { allow_images: true },
        metadata: { source: 'e2e' },
      })
      .expect(201);

    const createdProject =
      createResponse.body as unknown as ProjectResponseBody;

    expect(createdProject.organization_id).toBe(1);
    expect(createdProject.company_id).toBe(1);
    expect(createdProject.name).toBe('Inventario Matriz');
    expect(createdProject.status).toBe('draft');
    expect(typeof createdProject.created_by_id).toBe('number');
    expect(createdProject.available_actions).toEqual([
      { action: 'activate', permission: 'projects:activate' },
      { action: 'cancel', permission: 'projects:cancel' },
    ]);

    const projectId = createdProject.id;

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(200);

    const projectList = listResponse.body as unknown as ProjectListResponseBody;

    expect(projectList.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: projectId })]),
    );
    expect(projectList.page).toBe(1);
    expect(projectList.page_size).toBe(20);
    expect(typeof projectList.total_items).toBe('number');

    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ name: 'Inventario Matriz Atualizado' })
      .expect(200)
      .expect((response) => {
        const body = response.body as unknown as ProjectResponseBody;
        expect(body.name).toBe('Inventario Matriz Atualizado');
      });

    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ status: 'finished' })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ settings: { unsupported: true }, metadata: { source: 'patch' } })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/activate`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(200)
      .expect((response) => {
        expect((response.body as ProjectResponseBody).status).toBe('active');
      });

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/finish`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(200)
      .expect((response) => {
        const body = response.body as unknown as ProjectResponseBody;
        expect(body.status).toBe('finished');
        expect(body.finished_at).toEqual(expect.any(String));
      });

    const auditRepository = app.get<Repository<ProjectAuditLogEntity>>(
      getRepositoryToken(ProjectAuditLogEntity),
    );
    const auditOperations = (
      await auditRepository.find({ where: { projectId } })
    ).map((audit) => audit.operation);
    expect(auditOperations).toEqual(
      expect.arrayContaining([
        ProjectAuditOperation.CREATE,
        ProjectAuditOperation.UPDATE,
        ProjectAuditOperation.ACTIVATE,
        ProjectAuditOperation.FINISH,
      ]),
    );

    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ name: 'Nao deve alterar' })
      .expect(409);
  });

  it('pauses, resumes, cancels and archives only through allowed transitions', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ organization_id: 1, company_id: 1, name: 'Ciclo completo' })
      .expect(201);
    const projectId = (created.body as ProjectResponseBody).id;

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/pause`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(409)
      .expect((response) => {
        const body = response.body as unknown as ProjectErrorResponseBody;
        expect(body.code).toBe('PROJECT_STATUS_TRANSITION_NOT_ALLOWED');
      });

    for (const [action, expectedStatus] of [
      ['activate', 'active'],
      ['pause', 'paused'],
      ['resume', 'active'],
      ['cancel', 'cancelled'],
      ['archive', 'archived'],
    ] as const) {
      await request(app.getHttpServer())
        .post(`/api/v1/projects/${projectId}/${action}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .expect(200)
        .expect((response) => {
          expect((response.body as ProjectResponseBody).status).toBe(
            expectedStatus,
          );
        });

      if (action === 'pause') {
        await request(app.getHttpServer())
          .post(`/api/v1/projects/${projectId}/pause`)
          .set('Authorization', `Bearer ${orgAdminToken}`)
          .expect(409)
          .expect((response) => {
            const body = response.body as unknown as ProjectErrorResponseBody;
            expect(body.code).toBe('PROJECT_STATUS_TRANSITION_NOT_ALLOWED');
          });
      }
    }

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/activate`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(409);
  });

  it('blocks finish, cancel and legacy deactivate while operational records are open', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ organization_id: 1, company_id: 1, name: 'Com pendencias' })
      .expect(201);
    const projectId = (created.body as ProjectResponseBody).id;

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/activate`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(200);

    const itemRepository = app.get<Repository<InventoryItemEntity>>(
      getRepositoryToken(InventoryItemEntity),
    );
    await itemRepository.save(
      itemRepository.create({
        organizationId: 1,
        projectId,
        status: InventoryItemStatus.PENDING,
        metadata: null,
        createdById: null,
        updatedById: null,
        deletedAt: null,
      }),
    );

    for (const action of ['finish', 'cancel', 'deactivate'] as const) {
      await request(app.getHttpServer())
        .post(`/api/v1/projects/${projectId}/${action}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .expect(409)
        .expect((response) => {
          const body = response.body as unknown as ProjectErrorResponseBody;
          expect(body.code).toBe('PROJECT_HAS_OPEN_OPERATIONS');
          expect(body.details?.operations).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                type: 'inventory_item_pending',
                count: 1,
              }),
            ]),
          );
        });
    }
  });

  it('blocks archive while operational records are open', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ organization_id: 1, company_id: 1, name: 'Arquivo pendente' })
      .expect(201);
    const projectId = (created.body as ProjectResponseBody).id;

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/cancel`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(200);

    const itemRepository = app.get<Repository<InventoryItemEntity>>(
      getRepositoryToken(InventoryItemEntity),
    );
    await itemRepository.save(
      itemRepository.create({
        organizationId: 1,
        projectId,
        status: InventoryItemStatus.PENDING,
        metadata: null,
        createdById: null,
        updatedById: null,
        deletedAt: null,
      }),
    );

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/archive`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(409)
      .expect((response) => {
        const body = response.body as unknown as ProjectErrorResponseBody;
        expect(body.code).toBe('PROJECT_HAS_OPEN_OPERATIONS');
        expect(body.details?.operations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'inventory_item_pending',
              count: 1,
            }),
          ]),
        );
      });
  });

  it('rejects a stale field update without overwriting concurrent finish data', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ organization_id: 1, company_id: 1, name: 'Projeto concorrente' })
      .expect(201);
    const projectId = (created.body as ProjectResponseBody).id;

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/activate`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(200);

    const projectRepository = app.get<ProjectRepository>(PROJECT_REPOSITORY);
    const staleProject = await projectRepository.findById(projectId);
    expect(staleProject).not.toBeNull();

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/finish`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(200);

    const result = await projectRepository.updateFieldsWithAudit({
      id: projectId,
      expectedStatus: staleProject!.status,
      expectedUpdatedAt: staleProject!.updatedAt,
      fields: { name: 'Nome de uma leitura antiga' },
      actorId: 1,
      now: new Date(),
      audit: {
        projectId,
        organizationId: 1,
        operation: ProjectAuditOperation.UPDATE,
        performedBy: 1,
        changes: {
          name: {
            before: staleProject!.name,
            after: 'Nome de uma leitura antiga',
          },
        },
      },
    });

    expect(result.kind).toBe('concurrent_modification');
    const current = await projectRepository.findById(projectId);
    expect(current?.status).toBe('finished');
    expect(current?.finishedAt).toBeInstanceOf(Date);
    expect(current?.name).toBe('Projeto concorrente');

    const auditRepository = app.get<Repository<ProjectAuditLogEntity>>(
      getRepositoryToken(ProjectAuditLogEntity),
    );
    const staleUpdateAuditCount = await auditRepository.count({
      where: { projectId, operation: ProjectAuditOperation.UPDATE },
    });
    expect(staleUpdateAuditCount).toBe(0);
  });

  it('allows an operational user with projects permissions', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${orgUserToken}`)
      .expect(200);
  });

  it('rejects invalid date ranges', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({
        organization_id: 1,
        company_id: 1,
        name: 'Datas invalidas',
        start_date: '2026-08-10',
        end_date: '2026-08-01',
      })
      .expect(400);
  });
});
