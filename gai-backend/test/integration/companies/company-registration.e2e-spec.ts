import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { PermissionEntity } from '../../../src/modules/users/infrastructure/persistence/permission.entity';
import { RolePermissionEntity } from '../../../src/modules/users/infrastructure/persistence/role-permission.entity';
import { OrganizationEntity } from '../../../src/modules/organizations/infrastructure/persistence/organization.entity';
import { CompanyEntity } from '../../../src/modules/companies/infrastructure/persistence/company.entity';
import { CompanyAuditLogEntity } from '../../../src/modules/companies/infrastructure/persistence/company-audit-log.entity';
import {
  createTestApp,
  seedTestData,
  loginAsOrgAdmin,
  loginAsAdmin,
  loginAsOrgUser,
} from '../test-app.helper';

describe('Company registration and tenant security', () => {
  let app: INestApplication;
  let token: string;
  const data = {
    name: 'Empresa completa',
    corporate_name: 'Empresa completa Ltda',
    document: '12.abc.345/01de-35',
    state_registration: 'ISENTO',
    municipal_registration: '123',
    email: 'contato@empresa.com.br',
    phone: '(11) 99999-8888',
    zipcode: '01001-000',
    address: 'Praça da Sé',
    number: '10',
    complement: 'Sala 2',
    district: 'Sé',
    city: 'São Paulo',
    state: 'SP',
    country: 'BR',
    metadata: { source: 'manual', preserved: true },
  };
  const api = () => request(app.getHttpServer());
  beforeEach(async () => {
    app = await createTestApp();
    await seedTestData(app);
    token = await loginAsOrgAdmin(app);
  });
  afterEach(async () => {
    await app.close();
  });

  it('creates in the authenticated organization and returns every field, then updates partially without losing metadata or audit', async () => {
    const created = await api()
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${token}`)
      .send(data)
      .expect(201);
    const company = created.body as Record<string, unknown> & { id: number };
    expect(company).toMatchObject({
      ...data,
      organization_id: 1,
      document: '12ABC34501DE35',
      phone: '11999998888',
      zipcode: '01001000',
      status: 'active',
    });
    const patch = {
      corporate_name: 'Nova razão',
      state_registration: null,
      municipal_registration: '',
      email: null,
      phone: '(11) 3333-4444',
      zipcode: '20040-020',
      address: 'Rua nova',
      number: 'S/N',
      complement: null,
      district: 'Centro',
      city: 'Rio de Janeiro',
      state: 'RJ',
      country: 'BR',
    };
    const updated = await api()
      .patch(`/api/v1/companies/${company.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(patch)
      .expect(200);
    expect(updated.body).toMatchObject({
      ...patch,
      municipal_registration: null,
      phone: '1133334444',
      zipcode: '20040020',
      document: '12ABC34501DE35',
      name: data.name,
      metadata: data.metadata,
      created_by_id: company.created_by_id,
      updated_by_id: company.created_by_id,
    });
    const queried = await api()
      .get(`/api/v1/companies/${company.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(queried.body).toEqual(updated.body);
    const audits = await app
      .get<
        Repository<CompanyAuditLogEntity>
      >(getRepositoryToken(CompanyAuditLogEntity))
      .find({ where: { companyId: company.id } });
    expect(audits).toHaveLength(2);
    expect(audits[1].changes).toMatchObject({
      city: { before: 'São Paulo', after: 'Rio de Janeiro' },
    });
  });

  it('rejects forged tenant, protected fields and missing global organization', async () => {
    await api()
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Fraude', organization_id: 2 })
      .expect(403);
    const created = await api()
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Segura' })
      .expect(201);
    for (const field of [
      'organization_id',
      'id',
      'created_by_id',
      'updated_by_id',
      'deleted_at',
    ])
      await api()
        .patch(`/api/v1/companies/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ [field]: 2 })
        .expect(400);
    const globalToken = await loginAsAdmin(app);
    await api()
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${globalToken}`)
      .send({ name: 'Sem organização' })
      .expect(400);
  });

  it('isolates list, detail, update, deactivation and restoration across organizations', async () => {
    const organizations = app.get<Repository<OrganizationEntity>>(
      getRepositoryToken(OrganizationEntity),
    );
    const otherOrganization = await organizations.save(
      organizations.create({
        legalName: 'Outra organização',
        cnpj: '12345678000195',
      }),
    );
    const companies = app.get<Repository<CompanyEntity>>(
      getRepositoryToken(CompanyEntity),
    );
    const other = await companies.save(
      companies.create({
        organizationId: otherOrganization.id,
        name: 'Outra organização',
        status: 'active' as CompanyEntity['status'],
      }),
    );
    const list = await api()
      .get('/api/v1/companies')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      (list.body.items as CompanyEntity[]).some((row) => row.id === other.id),
    ).toBe(false);
    await api()
      .get('/api/v1/companies?organization_id=2')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    await api()
      .get(`/api/v1/companies/${other.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    await api()
      .patch(`/api/v1/companies/${other.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Invadida' })
      .expect(403);
    for (const action of ['deactivate', 'reactivate'])
      await api()
        .post(`/api/v1/companies/${other.id}/${action}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
  });

  it('normalizes documents, searches both formats and reserves a document after logical deletion', async () => {
    const created = await api()
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${token}`)
      .send(data)
      .expect(201);
    for (const query of [
      'search=12.abc.345%2F01de-35',
      'document=12.abc.345%2F01de-35',
    ]) {
      const list = await api()
        .get(`/api/v1/companies?${query}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(list.body.items).toHaveLength(1);
    }
    await api()
      .post(`/api/v1/companies/${created.body.id}/deactivate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await api()
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${token}`)
      .send(data)
      .expect(409);
    await api()
      .patch(`/api/v1/companies/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ city: 'Mudança' })
      .expect(409);
    await api()
      .post(`/api/v1/companies/${created.body.id}/reactivate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await api()
      .patch(`/api/v1/companies/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ document: '11.444.777/0001-61' })
      .expect(200);
    const found = await api()
      .get('/api/v1/companies?search=11.444.777%2F0001-61')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(found.body.items).toHaveLength(1);
  });

  it.each([
    '12ABC34501DE34',
    '12ABC34501DE3A',
    '00000000000000',
    '11444777000160',
    '12!ABC34501DE35',
  ])('rejects invalid CNPJ %s', async (document) => {
    await api()
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Inválida', document })
      .expect(400);
  });

  it('validates contact data and preserves manual international addresses', async () => {
    for (const invalid of [
      { phone: '123' },
      { email: 'inválido' },
      { zipcode: '123' },
      { city: 'x'.repeat(121) },
      { name: null },
    ])
      await api()
        .post('/api/v1/companies')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Inválida', ...invalid })
        .expect(400);
    await api()
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Internacional',
        country: 'US',
        zipcode: '10001-1234',
        phone: '+1 212 555 1234',
      })
      .expect(201);
  });

  it('requires lifecycle permissions even when status is sent through PATCH', async () => {
    const permission = await app
      .get<Repository<PermissionEntity>>(getRepositoryToken(PermissionEntity))
      .findOneByOrFail({ key: 'companies:deactivate' });
    await app
      .get<
        Repository<RolePermissionEntity>
      >(getRepositoryToken(RolePermissionEntity))
      .delete({ permissionId: permission.id });
    const created = await api()
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Protegida' })
      .expect(201);
    const userToken = await loginAsOrgUser(app);
    await api()
      .patch(`/api/v1/companies/${created.body.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ status: 'inactive' })
      .expect(403);
    await api()
      .patch(`/api/v1/companies/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'blocked' })
      .expect(200);
    await api()
      .patch(`/api/v1/companies/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'active', metadata: null })
      .expect(200);
  });
});
