import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  loginAsOrgAdmin,
  loginAsOrgUser,
  seedTestData,
} from '../test-app.helper';

interface ProjectResponseBody {
  id: number;
}

interface InventoryItemResponseBody {
  id: number;
}

interface ImageResponseBody {
  id: number;
  organization_id: number;
  inventory_item_id: number;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  checksum: string | null;
  status: string;
  deleted_at: string | null;
  bucket?: string;
  path?: string;
}

interface UploadUrlResponseBody {
  image: ImageResponseBody;
  upload_url: string;
  expires_in_seconds: number;
}

interface DownloadUrlResponseBody {
  image: ImageResponseBody;
  download_url: string;
  expires_in_seconds: number;
}

interface ImageListResponseBody {
  items: ImageResponseBody[];
}

describe('Inventory Item Images (e2e)', () => {
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

  async function createProjectAndItem(): Promise<{
    project: ProjectResponseBody;
    item: InventoryItemResponseBody;
  }> {
    const projectResponse = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({
        organization_id: 1,
        company_id: 1,
        name: 'Inventario com imagens',
      })
      .expect(201);
    const project = projectResponse.body as ProjectResponseBody;

    const itemResponse = await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/inventory-items`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ description: 'Camera fotografada' })
      .expect(201);

    return {
      project,
      item: itemResponse.body as InventoryItemResponseBody,
    };
  }

  it('creates upload url, confirms, lists, downloads and removes an image', async () => {
    const { project, item } = await createProjectAndItem();

    const uploadResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${project.id}/inventory-items/${item.id}/images/upload-url`,
      )
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({
        original_name: 'Foto 01.JPG',
        mime_type: 'image/jpeg',
        size_bytes: 1024,
        checksum: 'abc123',
      })
      .expect(201);

    const upload = uploadResponse.body as UploadUrlResponseBody;
    expect(upload.upload_url).toContain('X-GAI-Signature');
    expect(upload.expires_in_seconds).toBe(300);
    expect(upload.image.status).toBe('pending_upload');
    expect(upload.image.organization_id).toBe(1);
    expect(upload.image.inventory_item_id).toBe(item.id);
    expect(upload.image.bucket).toBeUndefined();
    expect(upload.image.path).toBeUndefined();

    await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${project.id}/inventory-items/${item.id}/images/${upload.image.id}/confirm-upload`,
      )
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ checksum: 'confirmed' })
      .expect(200)
      .expect((response) => {
        const body = response.body as ImageResponseBody;
        expect(body.status).toBe('uploaded');
        expect(body.checksum).toBe('confirmed');
      });

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${project.id}/inventory-items/${item.id}/images`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(200)
      .expect((response) => {
        const body = response.body as ImageListResponseBody;
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: upload.image.id }),
          ]),
        );
      });

    await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${project.id}/inventory-items/${item.id}/images/${upload.image.id}/download-url`,
      )
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(200)
      .expect((response) => {
        const body = response.body as DownloadUrlResponseBody;
        expect(body.download_url).toContain('X-GAI-Method=GET');
        expect(body.image.id).toBe(upload.image.id);
      });

    await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${project.id}/inventory-items/${item.id}/images/${upload.image.id}/remove`,
      )
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(200)
      .expect((response) => {
        const body = response.body as ImageResponseBody;
        expect(body.status).toBe('removed');
        expect(body.deleted_at).toEqual(expect.any(String));
      });
  });

  it('allows an operational user with image permissions to list images', async () => {
    const { project, item } = await createProjectAndItem();

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${project.id}/inventory-items/${item.id}/images`)
      .set('Authorization', `Bearer ${orgUserToken}`)
      .expect(200);
  });

  it('rejects unsupported mime type and project blocked mutations', async () => {
    const { project, item } = await createProjectAndItem();

    await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${project.id}/inventory-items/${item.id}/images/upload-url`,
      )
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({
        original_name: 'file.gif',
        mime_type: 'image/gif',
        size_bytes: 100,
      })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${project.id}/inventory-items/${item.id}`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ status: 'evaluated' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/cancel`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${project.id}/inventory-items/${item.id}/images/upload-url`,
      )
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({
        original_name: 'file.jpg',
        mime_type: 'image/jpeg',
        size_bytes: 100,
      })
      .expect(409);
  });

  it('enforces the max 3 images per item rule', async () => {
    const { project, item } = await createProjectAndItem();

    for (let index = 0; index < 3; index += 1) {
      await request(app.getHttpServer())
        .post(
          `/api/v1/projects/${project.id}/inventory-items/${item.id}/images/upload-url`,
        )
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({
          original_name: `file-${index}.jpg`,
          mime_type: 'image/jpeg',
          size_bytes: 100,
        })
        .expect(201);
    }

    await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${project.id}/inventory-items/${item.id}/images/upload-url`,
      )
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({
        original_name: 'file-4.jpg',
        mime_type: 'image/jpeg',
        size_bytes: 100,
      })
      .expect(409);
  });
});
