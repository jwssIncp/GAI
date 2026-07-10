import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  loginAsAdmin,
  loginAsOrgAdmin,
  seedTestData,
} from '../test-app.helper';

describe('Users - Org Roles (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let orgToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    adminToken = await loginAsAdmin(app);
    orgToken = await loginAsOrgAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /organizations/:id/roles lists custom roles', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/organizations/1/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Operador', is_active: true }),
      ]),
    );
  });

  it('POST /organizations/:id/roles creates custom role with permissions', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/organizations/1/roles')
      .set('Authorization', `Bearer ${orgToken}`)
      .send({
        name: 'Auditor',
        description: 'Somente leitura',
        permission_ids: [3],
      })
      .expect(201);

    expect(response.body.name).toBe('Auditor');
    expect(response.body.organization_id).toBe(1);
    expect(response.body.permissions).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'users:read' })]),
    );
  });

  it('GET /organizations/:id/roles/:roleId returns role detail', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v1/organizations/1/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const auditor = list.body.find(
      (r: { name: string }) => r.name === 'Auditor',
    );
    expect(auditor).toBeDefined();

    const response = await request(app.getHttpServer())
      .get(`/api/v1/organizations/1/roles/${auditor.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.name).toBe('Auditor');
    expect(response.body.permissions.length).toBeGreaterThan(0);
  });
});
