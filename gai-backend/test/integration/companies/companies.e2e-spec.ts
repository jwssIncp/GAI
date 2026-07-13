import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { CompanyStatus } from '../../../src/modules/companies/domain/enums/company-status.enum';
import { CompanyUnitStatus } from '../../../src/modules/companies/domain/enums/company-unit-status.enum';
import { CompanyAuditLogEntity } from '../../../src/modules/companies/infrastructure/persistence/company-audit-log.entity';
import { CompanyUnitEntity } from '../../../src/modules/companies/infrastructure/persistence/company-unit.entity';
import { CompanyEntity } from '../../../src/modules/companies/infrastructure/persistence/company.entity';
import { ProjectUnitAuditLogEntity } from '../../../src/modules/companies/infrastructure/persistence/project-unit-audit-log.entity';
import { OrganizationStatus } from '../../../src/modules/organizations/domain/enums/organization-status.enum';
import { OrganizationEntity } from '../../../src/modules/organizations/infrastructure/persistence/organization.entity';
import { ProjectEntity } from '../../../src/modules/projects/infrastructure/persistence/project.entity';
import {
  createTestApp,
  loginAsOrgUser,
  seedTestData,
} from '../test-app.helper';

interface CompanyBody {
  id: number;
  organization_id: number;
  document: string | null;
  status: string;
}

interface UnitBody {
  id: number;
  company_id: number;
  status: string;
}

interface ProjectBody {
  id: number;
  company_id: number | null;
}

interface ProjectUnitBody {
  id: number;
  project_id: number;
  company_unit_id: number;
  company_unit: UnitBody & { name: string };
  deleted_at: string | null;
}

interface ErrorBody {
  code: string;
}

describe('Companies and Company Units API (e2e)', () => {
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

  it('creates company, unit, project assignment and audit records', async () => {
    const companyResponse = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${token}`)
      .send({
        organization_id: 1,
        name: ' MAERSK ',
        corporate_name: 'Maersk Brasil LTDA',
        document: '11.444.777/0001-61',
        city: 'Santos',
      })
      .expect(201);
    const company = companyResponse.body as CompanyBody;

    expect(company).toMatchObject({
      organization_id: 1,
      document: '11444777000161',
      status: 'active',
    });

    await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${token}`)
      .send({
        organization_id: 1,
        name: 'Duplicada',
        document: '11.444.777/0001-61',
      })
      .expect(409);

    const unitResponse = await request(app.getHttpServer())
      .post(`/api/v1/companies/${company.id}/units`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Galpao Modulos 1 e 2', code: 'GLP-01' })
      .expect(201);
    const unit = unitResponse.body as UnitBody;
    expect(unit.company_id).toBe(company.id);

    const projectResponse = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        organization_id: 1,
        company_id: company.id,
        name: 'Inventario MAERSK',
      })
      .expect(201);
    const project = projectResponse.body as ProjectBody;
    expect(project.company_id).toBe(company.id);

    const assignmentResponse = await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/units`)
      .set('Authorization', `Bearer ${token}`)
      .send({ company_unit_id: unit.id })
      .expect(201);
    const assignment = assignmentResponse.body as ProjectUnitBody;
    expect(assignment).toMatchObject({
      project_id: project.id,
      company_unit_id: unit.id,
      company_unit: { id: unit.id, company_id: company.id, status: 'active' },
      deleted_at: null,
    });

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/units`)
      .set('Authorization', `Bearer ${token}`)
      .send({ company_unit_id: unit.id })
      .expect(409)
      .expect((response) => {
        expect((response.body as ErrorBody).code).toBe(
          'PROJECT_UNIT_ALREADY_ASSIGNED',
        );
      });

    const removedResponse = await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/units/${unit.id}/remove`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect((removedResponse.body as ProjectUnitBody).deleted_at).toEqual(
      expect.any(String),
    );

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/units/${unit.id}/remove`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409)
      .expect((response) => {
        expect((response.body as ErrorBody).code).toBe(
          'PROJECT_UNIT_ALREADY_REMOVED',
        );
      });

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${project.id}/units`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect({ items: [] });

    const reassignedResponse = await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/units`)
      .set('Authorization', `Bearer ${token}`)
      .send({ company_unit_id: unit.id })
      .expect(201);
    expect(reassignedResponse.body).toMatchObject({
      id: assignment.id,
      company_unit: { id: unit.id, name: 'Galpao Modulos 1 e 2' },
      deleted_at: null,
    });

    const companyAuditRepo = app.get<Repository<CompanyAuditLogEntity>>(
      getRepositoryToken(CompanyAuditLogEntity),
    );
    const projectUnitAuditRepo = app.get<Repository<ProjectUnitAuditLogEntity>>(
      getRepositoryToken(ProjectUnitAuditLogEntity),
    );
    await expect(companyAuditRepo.count()).resolves.toBeGreaterThanOrEqual(1);
    await expect(projectUnitAuditRepo.count()).resolves.toBe(3);
  });

  it('blocks project-unit mutations after the project becomes terminal', async () => {
    const unitResponse = await request(app.getHttpServer())
      .post('/api/v1/companies/1/units')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Unidade terminal' })
      .expect(201);
    const unit = unitResponse.body as UnitBody;
    const projectResponse = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ organization_id: 1, company_id: 1, name: 'Projeto terminal' })
      .expect(201);
    const project = projectResponse.body as ProjectBody;

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/units`)
      .set('Authorization', `Bearer ${token}`)
      .send({ company_unit_id: unit.id })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/units`)
      .set('Authorization', `Bearer ${token}`)
      .send({ company_unit_id: unit.id })
      .expect(409)
      .expect((response) => {
        expect((response.body as unknown as ErrorBody).code).toBe(
          'PROJECT_STATUS_BLOCKS_OPERATION',
        );
      });

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/units/${unit.id}/remove`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409)
      .expect((response) => {
        expect((response.body as ErrorBody).code).toBe(
          'PROJECT_STATUS_BLOCKS_OPERATION',
        );
      });

    const auditRepository = app.get<Repository<ProjectUnitAuditLogEntity>>(
      getRepositoryToken(ProjectUnitAuditLogEntity),
    );
    await expect(auditRepository.count()).resolves.toBe(1);
  });

  it('prevents assigning inactive units to projects', async () => {
    const unitResponse = await request(app.getHttpServer())
      .post('/api/v1/companies/1/units')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Unidade temporaria' })
      .expect(201);
    const unit = unitResponse.body as UnitBody;

    await request(app.getHttpServer())
      .post(`/api/v1/companies/1/units/${unit.id}/deactivate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const projectResponse = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ organization_id: 1, company_id: 1, name: 'Projeto bloqueio' })
      .expect(201);
    const project = projectResponse.body as ProjectBody;

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/units`)
      .set('Authorization', `Bearer ${token}`)
      .send({ company_unit_id: unit.id })
      .expect(409)
      .expect((response) => {
        expect((response.body as ErrorBody).code).toBe(
          'COMPANY_UNIT_STATUS_BLOCKS_OPERATION',
        );
      });
  });

  it('lists a legacy project without company and only requires company on assign', async () => {
    const unitResponse = await request(app.getHttpServer())
      .post('/api/v1/companies/1/units')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Unidade de projeto legado' })
      .expect(201);
    const unit = unitResponse.body as UnitBody;

    const projectResponse = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ organization_id: 1, company_id: 1, name: 'Projeto legado' })
      .expect(201);
    const project = projectResponse.body as ProjectBody;

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/units`)
      .set('Authorization', `Bearer ${token}`)
      .send({ company_unit_id: unit.id })
      .expect(201);

    const projectRepository = app.get<Repository<ProjectEntity>>(
      getRepositoryToken(ProjectEntity),
    );
    await projectRepository.update(project.id, { companyId: null });

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${project.id}/units`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect({ items: [] });

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/units/${unit.id}/remove`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/units`)
      .set('Authorization', `Bearer ${token}`)
      .send({ company_unit_id: unit.id })
      .expect(409)
      .expect((response) => {
        expect((response.body as ErrorBody).code).toBe(
          'PROJECT_HAS_NO_COMPANY',
        );
      });

    const auditRepository = app.get<Repository<ProjectUnitAuditLogEntity>>(
      getRepositoryToken(ProjectUnitAuditLogEntity),
    );
    await expect(auditRepository.count()).resolves.toBe(2);
  });

  it('rejects a unit from another tenant without writing an audit row', async () => {
    const organizationRepository = app.get<Repository<OrganizationEntity>>(
      getRepositoryToken(OrganizationEntity),
    );
    const companyRepository = app.get<Repository<CompanyEntity>>(
      getRepositoryToken(CompanyEntity),
    );
    const unitRepository = app.get<Repository<CompanyUnitEntity>>(
      getRepositoryToken(CompanyUnitEntity),
    );
    const otherOrganization = await organizationRepository.save(
      organizationRepository.create({
        legalName: 'Outra organizacao LTDA',
        tradeName: 'Outra organizacao',
        cnpj: '12345678000195',
        contactEmail: null,
        contactPhone: null,
        status: OrganizationStatus.ACTIVE,
      }),
    );
    const otherCompany = await companyRepository.save(
      companyRepository.create({
        organizationId: otherOrganization.id,
        name: 'Empresa de outro tenant',
        corporateName: null,
        document: null,
        status: CompanyStatus.ACTIVE,
        metadata: null,
        createdById: null,
        updatedById: null,
      }),
    );
    const otherUnit = await unitRepository.save(
      unitRepository.create({
        organizationId: otherOrganization.id,
        companyId: otherCompany.id,
        name: 'Unidade de outro tenant',
        code: null,
        status: CompanyUnitStatus.ACTIVE,
        metadata: null,
        createdById: null,
        updatedById: null,
      }),
    );

    const projectResponse = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ organization_id: 1, company_id: 1, name: 'Projeto isolado' })
      .expect(201);
    const project = projectResponse.body as ProjectBody;

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/units`)
      .set('Authorization', `Bearer ${token}`)
      .send({ company_unit_id: otherUnit.id })
      .expect(409)
      .expect((response) => {
        expect((response.body as ErrorBody).code).toBe(
          'PROJECT_UNIT_SCOPE_MISMATCH',
        );
      });

    const auditRepository = app.get<Repository<ProjectUnitAuditLogEntity>>(
      getRepositoryToken(ProjectUnitAuditLogEntity),
    );
    await expect(auditRepository.count()).resolves.toBe(0);
  });
});
