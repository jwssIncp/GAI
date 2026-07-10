import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { CompanyAuditLogEntity } from '../../../src/modules/companies/infrastructure/persistence/company-audit-log.entity';
import { ProjectUnitAuditLogEntity } from '../../../src/modules/companies/infrastructure/persistence/project-unit-audit-log.entity';
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
  company_id: number;
}

interface ProjectUnitBody {
  id: number;
  project_id: number;
  company_unit_id: number;
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
    });

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/units/${unit.id}/remove`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const companyAuditRepo = app.get<Repository<CompanyAuditLogEntity>>(
      getRepositoryToken(CompanyAuditLogEntity),
    );
    const projectUnitAuditRepo = app.get<Repository<ProjectUnitAuditLogEntity>>(
      getRepositoryToken(ProjectUnitAuditLogEntity),
    );
    await expect(companyAuditRepo.count()).resolves.toBeGreaterThanOrEqual(1);
    await expect(projectUnitAuditRepo.count()).resolves.toBe(2);
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
      .expect(409);
  });
});
