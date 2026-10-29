import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import {
  createTestApp,
  seedTestData,
  loginAsOrgAdmin,
  loginAsOrgUser,
} from '../test-app.helper';
import { EXPORT_CONTENT_PERMISSIONS } from '../../../src/modules/export-jobs/domain/export-content-permissions';
import { ExportJobType } from '../../../src/modules/export-jobs/domain/enums/export-job-type.enum';
import { RoleEntity } from '../../../src/modules/users/infrastructure/persistence/role.entity';
import { RolePermissionEntity } from '../../../src/modules/users/infrastructure/persistence/role-permission.entity';
import { PermissionEntity } from '../../../src/modules/users/infrastructure/persistence/permission.entity';
import { ExportJobEntity } from '../../../src/modules/export-jobs/infrastructure/persistence/export-job.entity';

describe('Specialized financial exports require each content permission (MySQL)', () => {
  let app: INestApplication,
    ds: DataSource,
    user: string,
    project: number,
    role: RoleEntity;
  beforeAll(async () => {
    if (process.env.GAI_TEST_MYSQL_DISPOSABLE !== '1')
      throw Error('Use the explicit disposable MySQL runner');
    app = await createTestApp();
    await seedTestData(app);
    ds = app.get(DataSource);
    const admin = await loginAsOrgAdmin(app);
    user = await loginAsOrgUser(app);
    project = (
      await request(app.getHttpServer())
        .post('/api/v1/projects')
        .auth(admin, { type: 'bearer' })
        .send({
          organization_id: 1,
          company_id: 1,
          name: 'SINTETICO exports onda1',
        })
        .expect(201)
    ).body.id;
    role = await ds
      .getRepository(RoleEntity)
      .findOneByOrFail({ name: 'Operador' });
  });
  afterAll(async () => {
    await app?.close();
  });
  async function grant(keys: string[]) {
    const perms = await ds.getRepository(PermissionEntity).find();
    expect(keys.every((k) => perms.some((p) => p.key === k))).toBe(true);
    const repo = ds.getRepository(RolePermissionEntity);
    await repo.delete({ roleId: role.id });
    await repo.save(
      perms
        .filter((p) => keys.includes(p.key))
        .map((p) => ({ roleId: role.id, permissionId: p.id })),
    );
  }
  it.each([ExportJobType.FINANCE_XLSX, ExportJobType.DRE_XLSX])(
    '%s rejects each missing read on its real endpoint and retains explicit filters',
    async (type) => {
      const reads = EXPORT_CONTENT_PERMISSIONS[type];
      const route =
        type === ExportJobType.DRE_XLSX
          ? '/finance/dre/exports'
          : '/finance/exports';
      const body =
        type === ExportJobType.DRE_XLSX
          ? {
              start_month: '2026-10',
              end_month: '2026-10',
              kind: 'statement',
              project_id: project,
            }
          : { kind: 'statement', filters: { project_id: project } };
      const jobs = ds.getRepository(ExportJobEntity),
        before = await jobs.count();
      for (const missing of reads) {
        await grant([
          'projects:read',
          'export-jobs:create',
          ...reads.filter((k) => k !== missing),
        ]);
        await request(app.getHttpServer())
          .post('/api/v1' + route)
          .auth(user, { type: 'bearer' })
          .send(body)
          .expect(403);
        expect(await jobs.count()).toBe(before);
      }
      await grant(['projects:read', 'export-jobs:create', ...reads]);
      const response = await request(app.getHttpServer())
        .post('/api/v1' + route)
        .auth(user, { type: 'bearer' })
        .send(body)
        .expect(201);
      const job = await jobs
        .createQueryBuilder('job')
        .addSelect('job.financePayload')
        .where('job.id = :id', { id: response.body.id })
        .getOneOrFail();
      expect(job.type).toBe(type);
      expect(Number(job.organizationId)).toBe(1);
      expect(Number(job.requestedById)).toBe(3);
      expect(job.financePayload?.filters).toMatchObject({
        project_id: project,
      });
    },
  );
});
