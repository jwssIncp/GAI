import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  loginAsOrgUser,
  seedTestData,
} from '../test-app.helper';

interface IdBody {
  id: number;
}

interface ImportSessionBody {
  id: number;
  session_uuid: string;
  status: string;
  total_created: number;
  total_failed: number;
}

interface ImportPayloadBody {
  id: number;
  payload_number: number;
  status: string;
  created_count: number;
  failed_count: number;
}

interface UploadBody {
  file: { id: number; status: string };
  upload_url: string;
}

interface ErrorListBody {
  total_items: number;
  items: Array<{ item_reference: string | null }>;
}

interface FileBody {
  status: string;
}

describe('Import Sessions (e2e)', () => {
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

  async function createProject(): Promise<number> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ organization_id: 1, company_id: 1, name: 'Importacao mobile' })
      .expect(201);
    return (response.body as IdBody).id;
  }

  it('creates session, processes payload idempotently and exposes errors/files', async () => {
    const projectId = await createProject();

    const sessionResponse = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/import-sessions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'mobile_sync',
        source: 'mobile_app',
        expected_payloads: 1,
      })
      .expect(201);
    const session = sessionResponse.body as ImportSessionBody;
    expect(session.session_uuid).toBeTruthy();

    const payloadBody = {
      payload_number: 1,
      idempotency_key: 'payload-1',
      checksum: 'checksum-1',
      items: [
        {
          operation: 'create',
          external_item_id: 'mobile-1',
          old_plate: ' ab-123 ',
          description: 'Notebook',
          used_value: '10.00',
        },
        {
          operation: 'update',
          external_item_id: 'missing-item',
          description: 'Nao existe',
        },
      ],
    };

    const payloadResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${projectId}/import-sessions/${session.id}/payloads`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send(payloadBody)
      .expect(201);
    const payload = payloadResponse.body as ImportPayloadBody;
    expect(payload.status).toBe('processed');
    expect(payload.created_count).toBe(1);
    expect(payload.failed_count).toBe(1);

    await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${projectId}/import-sessions/${session.id}/payloads`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send(payloadBody)
      .expect(201)
      .expect((response) => {
        const body = response.body as ImportPayloadBody;
        expect(body.id).toBe(payload.id);
        expect(body.failed_count).toBe(1);
      });

    await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${projectId}/import-sessions/${session.id}/payloads`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({ ...payloadBody, checksum: 'different' })
      .expect(409);

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/import-sessions/${session.id}/errors`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((response) => {
        const body = response.body as ErrorListBody;
        expect(body.total_items).toBe(1);
        expect(body.items[0].item_reference).toBe('missing-item');
      });

    const uploadResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${projectId}/import-sessions/${session.id}/files/upload-url`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'raw_backup',
        original_name: 'backup.json',
        mime_type: 'application/json',
        size_bytes: 123,
      })
      .expect(201);
    const upload = uploadResponse.body as UploadBody;
    expect(upload.upload_url).toContain('X-GAI-Signature');

    await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${projectId}/import-sessions/${session.id}/files/${upload.file.id}/confirm-upload`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({ checksum: 'file-checksum', size_bytes: 123 })
      .expect(200)
      .expect((response) => {
        const body = response.body as FileBody;
        expect(body.status).toBe('uploaded');
      });

    await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${projectId}/import-sessions/${session.id}/finish`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((response) => {
        const body = response.body as ImportSessionBody;
        expect(body.status).toBe('finished');
        expect(body.total_created).toBe(1);
        expect(body.total_failed).toBe(1);
      });
  });
});
