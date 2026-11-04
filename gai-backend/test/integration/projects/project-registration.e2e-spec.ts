import { fixturePasswords } from '../../fixtures/passwords';
import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import request from 'supertest';
import { UserStatus } from '../../../src/modules/auth/domain/enums/user.enums';
import { UserEntity } from '../../../src/modules/auth/infrastructure/persistence/user.entity';
import { CompanyStatus } from '../../../src/modules/companies/domain/enums/company-status.enum';
import { CompanyEntity } from '../../../src/modules/companies/infrastructure/persistence/company.entity';
import { CompanyUnitEntity } from '../../../src/modules/companies/infrastructure/persistence/company-unit.entity';
import { OrganizationEntity } from '../../../src/modules/organizations/infrastructure/persistence/organization.entity';
import { OrganizationStatus } from '../../../src/modules/organizations/domain/enums/organization-status.enum';
import { ProjectEntity } from '../../../src/modules/projects/infrastructure/persistence/project.entity';
import { ProjectAuditLogEntity } from '../../../src/modules/projects/infrastructure/persistence/project-audit-log.entity';
import { PermissionEntity } from '../../../src/modules/users/infrastructure/persistence/permission.entity';
import { RoleEntity } from '../../../src/modules/users/infrastructure/persistence/role.entity';
import { RolePermissionEntity } from '../../../src/modules/users/infrastructure/persistence/role-permission.entity';
import { UserRoleAssignmentEntity } from '../../../src/modules/users/infrastructure/persistence/user-role-assignment.entity';
import { RoleType } from '../../../src/modules/users/domain/enums/role-type.enum';
import {
  createTestApp,
  loginAsAdmin,
  loginAsOrgAdmin,
  seedTestData,
} from '../test-app.helper';

interface Result {
  id: number;
  organization_id: number;
  code: string;
  status: string;
  name: string;
  company_name: string | null;
  responsible_user_name: string | null;
  planning_notes: string | null;
}
describe('Project registration (isolated API and database)', () => {
  let app: INestApplication, db: DataSource, token: string, platform: string;
  let projects: Repository<ProjectEntity>,
    audits: Repository<ProjectAuditLogEntity>;
  let otherOrg: OrganizationEntity,
    otherCompany: CompanyEntity,
    inactiveCompany: CompanyEntity,
    inactiveOrg: OrganizationEntity,
    otherUser: UserEntity,
    localUser: UserEntity;
  const api = () => request(app.getHttpServer());
  const create = (fields: Record<string, unknown> = {}, auth?: string) =>
    api()
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${auth ?? token}`)
      .send({ company_id: 1, name: 'Projeto de teste', ...fields });
  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    db = app.get(DataSource);
    token = await loginAsOrgAdmin(app);
    platform = await loginAsAdmin(app);
    projects = db.getRepository(ProjectEntity);
    audits = db.getRepository(ProjectAuditLogEntity);
    const orgs = db.getRepository(OrganizationEntity),
      companies = db.getRepository(CompanyEntity),
      users = db.getRepository(UserEntity);
    otherOrg = await orgs.save(
      orgs.create({
        legalName: 'Outra organização',
        cnpj: '22333444000100',
        status: OrganizationStatus.ACTIVE,
      }),
    );
    inactiveOrg = await orgs.save(
      orgs.create({
        legalName: 'Organização inativa',
        cnpj: '33444555000100',
        status: OrganizationStatus.INACTIVE,
      }),
    );
    otherCompany = await companies.save(
      companies.create({
        name: 'Outra empresa',
        organizationId: otherOrg.id,
        status: CompanyStatus.ACTIVE,
      }),
    );
    inactiveCompany = await companies.save(
      companies.create({
        name: 'Empresa inativa',
        organizationId: 1,
        status: CompanyStatus.INACTIVE,
      }),
    );
    localUser = await users.findOneByOrFail({ login: 'org.admin' });
    otherUser = await users.save(
      users.create({
        organizationId: otherOrg.id,
        login: 'other.project.user',
        email: 'other.project@gai.local',
        passwordHash: localUser.passwordHash,
        passwordChangedAt: new Date(),
        status: UserStatus.ACTIVE,
      }),
    );
  });
  afterAll(async () => {
    if (app) await app.close();
  });

  it('derives the tenant, saves new fields and writes a complete creation audit atomically', async () => {
    const response = await create({
      code: ' inv-2026 ',
      project_type: 'inventory_valuation',
      description: 'Descrição',
      start_date: '2026-11-03',
      end_date: '2026-11-30',
      responsible_user_id: localUser.id,
      planning_responsible_user_id: localUser.id,
      planning_notes: 'Plano de execução',
      settings: { allow_images: true },
      metadata: { source: 'api' },
    }).expect(201);
    const result = response.body as Result;
    expect(result).toMatchObject({
      organization_id: 1,
      code: 'INV-2026',
      status: 'draft',
      planning_notes: 'Plano de execução',
    });
    const row = await projects.findOneByOrFail({ id: result.id });
    expect(row).toMatchObject({
      responsibleUserId: localUser.id,
      planningResponsibleUserId: localUser.id,
      projectType: 'inventory_valuation',
    });
    const audit = await audits.findOneByOrFail({ projectId: result.id });
    expect(audit.changes).toMatchObject({
      project_id: { before: null, after: result.id },
      description: { before: null, after: 'Descrição' },
      code: { before: null, after: 'INV-2026' },
      responsible_user_id: { before: null, after: localUser.id },
      settings: { before: null, after: { allow_images: true } },
      metadata: { before: null, after: { source: 'api' } },
    });
    expect(audit.performedBy).toBe(localUser.id);
    const detail = await api()
      .get(`/api/v1/projects/${result.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(detail.body as Result).toMatchObject({
      company_name: 'Empresa Teste',
      responsible_user_name: 'org.admin',
    });
  });
  it('rejects tenant tampering without writing project or audit rows', async () => {
    const before = [await projects.count(), await audits.count()];
    await create({ organization_id: otherOrg.id }).expect(403);
    expect([await projects.count(), await audits.count()]).toEqual(before);
  });
  it('allows global platform administration only with an explicit valid tenant', async () => {
    await create({}, platform).expect(403);
    const result = await create(
      { organization_id: otherOrg.id, company_id: otherCompany.id },
      platform,
    ).expect(201);
    expect((result.body as Result).organization_id).toBe(otherOrg.id);
    await create(
      { organization_id: otherOrg.id, company_id: 1 },
      platform,
    ).expect(409);
    await create({ organization_id: inactiveOrg.id }, platform).expect(409);
  });
  it.each(['responsible_user_id', 'planning_responsible_user_id'])(
    'rejects a cross-tenant %s',
    async (field) => {
      await create({ [field]: otherUser.id }).expect(409);
    },
  );
  it('rejects unavailable users, companies and organizations', async () => {
    await create({ responsible_user_id: 999999 }).expect(409);
    await create({ company_id: 999999 }).expect(404);
    await create({ company_id: inactiveCompany.id }).expect(409);
    await create({ company_id: otherCompany.id }).expect(409);
    await db
      .getRepository(UserEntity)
      .update(otherUser.id, { status: UserStatus.INACTIVE });
    await create(
      {
        organization_id: otherOrg.id,
        company_id: otherCompany.id,
        responsible_user_id: otherUser.id,
      },
      platform,
    ).expect(409);
    await db
      .getRepository(UserEntity)
      .update(otherUser.id, { status: UserStatus.ACTIVE });
  });
  it.each([
    { name: '' },
    { name: 'A' },
    { name: 'A'.repeat(256) },
    { description: 'X'.repeat(5001) },
    { start_date: '2026-11-30', end_date: '2026-11-03' },
    { start_date: '2026-02-30' },
    { metadata: { organization_id: 2 } },
    { settings: { nested: { permissions: [] } } },
    { settings: [] },
    { project_type: 'unknown' },
    { unexpected: true },
    { status: 'active' },
    { unit_ids: [1] },
  ])('rejects invalid/adulterated creation payload %#', async (fields) => {
    const response = await create(fields);
    expect([400, 422]).toContain(response.status);
  });
  it('permits equal names and enforces code uniqueness under concurrent requests', async () => {
    const requests = [
      () => create({ code: 'SAME-CODE', name: 'Nome repetido' }),
      () => create({ code: 'same-code', name: 'Nome repetido' }),
    ];
    // SQLite shares one connection; real concurrent transactions are verified on MySQL.
    const responses =
      db.options.type === 'mysql'
        ? await Promise.all(requests.map((run) => run()))
        : [await requests[0](), await requests[1]()];
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    const again = await create({ name: 'Nome repetido' }).expect(201);
    expect((again.body as Result).code).toMatch(/^PRJ-[A-F0-9]{12}$/);
    const other = await create(
      {
        organization_id: otherOrg.id,
        company_id: otherCompany.id,
        code: 'SAME-CODE',
      },
      platform,
    ).expect(201);
    expect((other.body as Result).organization_id).toBe(otherOrg.id);
  });
  it('keeps soft-deleted codes reserved', async () => {
    const created = await create({ code: 'RESERVED' }).expect(201);
    await projects.softDelete((created.body as Result).id);
    await create({ code: 'RESERVED' }).expect(409);
  });
  it('rolls back project insertion if audit insertion fails', async () => {
    const before = await projects.count();
    const original = Repository.prototype.save;
    const spy = jest
      .spyOn(Repository.prototype, 'save')
      .mockImplementation(function (
        this: Repository<object>,
        ...args: Parameters<typeof original>
      ) {
        if (this.metadata.tableName === 'project_audit_logs')
          return Promise.reject(new Error('Simulated audit storage failure'));
        return original.apply(this, args);
      } as typeof original);
    try {
      await create({ code: 'AUDIT-FAILURE' }).expect(500);
    } finally {
      spy.mockRestore();
    }
    expect(await projects.count()).toBe(before);
    expect(await projects.findOneBy({ code: 'AUDIT-FAILURE' })).toBeNull();
  });
  it('audits new editable fields and rejects immutable/cross-tenant edits', async () => {
    const response = await create({ code: 'EDIT-TEST' }).expect(201),
      id = (response.body as Result).id;
    await api()
      .patch(`/api/v1/projects/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        planning_notes: 'Plano revisado',
        responsible_user_id: localUser.id,
      })
      .expect(200);
    const audit = await audits.findOneByOrFail({
      projectId: id,
      operation: 'UPDATE',
    });
    expect(audit.changes).toMatchObject({
      planning_notes: { before: null, after: 'Plano revisado' },
      responsible_user_id: { before: null, after: localUser.id },
    });
    for (const fields of [
      { organization_id: 2 },
      { company_id: 2 },
      { status: 'active' },
    ])
      await api()
        .patch(`/api/v1/projects/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(fields)
        .expect(400);
    await api()
      .patch(`/api/v1/projects/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ responsible_user_id: otherUser.id })
      .expect(409);
  });
  it('rejects an outdated editor without overwriting a more recent update', async () => {
    const response = await create({ code: 'STALE-EDITOR' }).expect(201);
    const body = response.body as Result & { updated_at: string };
    await api()
      .patch(`/api/v1/projects/${body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Primeira atualização',
        expected_updated_at: body.updated_at,
      })
      .expect(200);
    await api()
      .patch(`/api/v1/projects/${body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Editor desatualizado',
        expected_updated_at: body.updated_at,
      })
      .expect(409);
    expect((await projects.findOneByOrFail({ id: body.id })).name).toBe(
      'Primeira atualização',
    );
  });
  it('isolates lists, detail, history, summaries and unit associations', async () => {
    const ownResponse = await create({ code: 'OWN-SCOPE' }).expect(201),
      ownId = (ownResponse.body as Result).id;
    const otherResponse = await create(
        {
          organization_id: otherOrg.id,
          company_id: otherCompany.id,
          code: 'OTHER-SCOPE',
        },
        platform,
      ).expect(201),
      otherId = (otherResponse.body as Result).id;
    for (const path of [
      `/projects/${otherId}`,
      `/projects/${otherId}/history`,
      `/projects/${otherId}/summary`,
      `/projects/${otherId}/units`,
      `/projects/${otherId}/field-agents`,
      `/projects/${otherId}/export-jobs`,
      `/projects?organization_id=${otherOrg.id}`,
    ])
      await api()
        .get('/api/v1' + path)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    await api()
      .patch(`/api/v1/projects/${otherId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Intrusão' })
      .expect(403);
    const unitRepo = db.getRepository(CompanyUnitEntity);
    const foreignUnit = await unitRepo.save(
      unitRepo.create({
        organizationId: otherOrg.id,
        companyId: otherCompany.id,
        name: 'Unidade externa',
        status: 'active' as CompanyUnitEntity['status'],
      }),
    );
    const response = await api()
      .post(`/api/v1/projects/${ownId}/units`)
      .set('Authorization', `Bearer ${token}`)
      .send({ company_unit_id: foreignUnit.id });
    expect([403, 409]).toContain(response.status);
    const history = await api()
      .get(`/api/v1/projects/${ownId}/history`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect((history.body as { total_items: number }).total_items).toBe(1);
  });
  it('provides only scoped option labels to a custom projects:create profile without companies:read', async () => {
    const users = db.getRepository(UserEntity),
      roles = db.getRepository(RoleEntity);
    const user = await users.save(
      users.create({
        login: 'project.creator.only',
        email: 'creator.only@gai.local',
        organizationId: 1,
        passwordHash: localUser.passwordHash,
        passwordChangedAt: new Date(),
        status: UserStatus.ACTIVE,
      }),
    );
    const role = await roles.save(
      roles.create({
        name: 'Project creator only',
        type: RoleType.ORGANIZATION,
        organizationId: 1,
        isActive: true,
      }),
    );
    const permission = await db
      .getRepository(PermissionEntity)
      .findOneByOrFail({ key: 'projects:create' });
    await db
      .getRepository(RolePermissionEntity)
      .save({ roleId: role.id, permissionId: permission.id });
    await db.getRepository(UserRoleAssignmentEntity).save({
      userId: user.id,
      roleId: role.id,
      isActive: true,
      assignedAt: new Date(),
    });
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ identifier: user.login, password: fixturePasswords.admin })
      .expect(200);
    const limited = (login.body as { access_token: string }).access_token;
    const options = await api()
      .get('/api/v1/projects/creation-options')
      .set('Authorization', `Bearer ${limited}`)
      .expect(200);
    expect((options.body as { items: unknown[] }).items).toEqual([
      { id: 1, name: 'Empresa Teste' },
    ]);
    await api()
      .get('/api/v1/companies/1')
      .set('Authorization', `Bearer ${limited}`)
      .expect(403);
    await api()
      .get(`/api/v1/projects/creation-options?organization_id=${otherOrg.id}`)
      .set('Authorization', `Bearer ${limited}`)
      .expect(403);
    await create({ name: 'Cadastro autorizado' }, limited).expect(201);
    // A logged-in user with no role receives no implicit creation permission.
    const deniedLogin = await api()
      .post('/api/v1/auth/login')
      .send({ identifier: otherUser.login, password: fixturePasswords.admin })
      .expect(200);
    await create(
      {},
      (deniedLogin.body as { access_token: string }).access_token,
    ).expect(403);
  });
  it('searches code, filters type and computes real filtered totals', async () => {
    await create({ code: 'FILTER-ONLY', project_type: 'valuation' }).expect(
      201,
    );
    const response = await api()
      .get(
        '/api/v1/projects?search=FILTER-ONLY&project_type=valuation&sort_by=code&sort_order=ASC',
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const body = response.body as {
      items: Result[];
      total_items: number;
      status_counts: Record<string, number>;
    };
    expect(body.total_items).toBe(1);
    expect(body.status_counts).toEqual({ draft: 1 });
    expect(body.items[0].company_name).toBe('Empresa Teste');
    const history = await api()
      .get(`/api/v1/projects/${body.items[0].id}/history`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(JSON.stringify(history.body)).not.toContain('passwordHash');
  });
});
