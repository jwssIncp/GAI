import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { CatalogAssetAuditLogEntity } from '../../../src/modules/catalog-assets/infrastructure/persistence/catalog-asset-audit-log.entity';
import {
  createTestApp,
  loginAsOrgUser,
  seedTestData,
} from '../test-app.helper';

interface CatalogAssetBody {
  id: number;
  organization_id: number;
  description: string;
  description_normalized: string;
  category: string | null;
  status: string;
  deleted_at: string | null;
}

interface CatalogAssetListBody {
  items: CatalogAssetBody[];
  total_items: number;
}

describe('Catalog Assets API (e2e)', () => {
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

  it('creates, lists, updates and audits catalog assets', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/catalog-assets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        organization_id: 1,
        description: '  Máquina   de Café  ',
        category: 'Copa',
        metadata: { source: 'e2e' },
      })
      .expect(201);
    const created = response.body as CatalogAssetBody;

    expect(created).toMatchObject({
      organization_id: 1,
      description: 'Máquina de Café',
      description_normalized: 'maquina de cafe',
      category: 'Copa',
      status: 'active',
    });

    const list = await request(app.getHttpServer())
      .get('/api/v1/catalog-assets?search=cafe&page=1&page_size=10')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const listBody = list.body as CatalogAssetListBody;

    expect(listBody.total_items).toBe(1);
    expect(listBody.items[0].id).toBe(created.id);

    await request(app.getHttpServer())
      .patch(`/api/v1/catalog-assets/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'Equipamentos' })
      .expect(200)
      .expect((res) => {
        const body = res.body as CatalogAssetBody;
        expect(body.category).toBe('Equipamentos');
      });

    const auditRepo = app.get<Repository<CatalogAssetAuditLogEntity>>(
      getRepositoryToken(CatalogAssetAuditLogEntity),
    );
    await expect(auditRepo.count()).resolves.toBe(2);
  });

  it('blocks duplicate normalized descriptions in the same organization', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/catalog-assets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        organization_id: 1,
        description: 'MÁQUINA de Café',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/catalog-assets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        organization_id: 1,
        description: ' maquina   de cafe ',
      })
      .expect(409);
  });

  it('deactivates and reactivates without deleting the record', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/catalog-assets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        organization_id: 1,
        description: 'Notebook Dell',
      })
      .expect(201);
    const created = response.body as CatalogAssetBody;

    await request(app.getHttpServer())
      .post(`/api/v1/catalog-assets/${created.id}/deactivate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        const body = res.body as CatalogAssetBody;
        expect(body.status).toBe('inactive');
        expect(body.deleted_at).toEqual(expect.any(String));
      });

    await request(app.getHttpServer())
      .post(`/api/v1/catalog-assets/${created.id}/reactivate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        const body = res.body as CatalogAssetBody;
        expect(body.status).toBe('active');
        expect(body.deleted_at).toBeNull();
      });
  });
});
