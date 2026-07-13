import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { ExportJobAuditOperation } from '../../../src/modules/export-jobs/domain/enums/export-job-audit-operation.enum';
import { ExportJobStatus } from '../../../src/modules/export-jobs/domain/enums/export-job-status.enum';
import { ExportJobAuditLogEntity } from '../../../src/modules/export-jobs/infrastructure/persistence/export-job-audit-log.entity';
import { ExportJobEntity } from '../../../src/modules/export-jobs/infrastructure/persistence/export-job.entity';
import {
  createTestApp,
  loginAsOrgAdmin,
  seedTestData,
} from '../test-app.helper';

interface ProjectBody {
  id: number;
}

interface ExportJobBody {
  id: number;
  project_id: number;
  type: string;
  status: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  checksum: string | null;
  retry_of_id: number | null;
  expires_at: string | null;
  error_code: string | null;
}

interface ExportJobListBody {
  items: ExportJobBody[];
  page: number;
  page_size: number;
  total_items: number;
}

interface ExportJobDownloadUrlBody {
  download_url: string;
  expires_in_seconds: number;
  requires_authentication: boolean;
}

interface ProjectSummaryBody {
  exports: {
    total_export_jobs: number;
    finished_export_jobs: number;
  };
  recent_activity: {
    last_export_finished_at: string | null;
  };
}

describe('Export Jobs (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    token = await loginAsOrgAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('generates, lists and downloads a real XLSX with audit and dashboard totals', async () => {
    const projectResponse = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        organization_id: 1,
        company_id: 1,
        name: 'Projeto exportavel',
      })
      .expect(201);
    const project = projectResponse.body as ProjectBody;

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/inventory-items`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        old_plate: 'EXP-001',
        description: 'Notebook real no XLSX',
        used_value: '1500.50',
      })
      .expect(201);

    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/export-jobs`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'inventory_items_xlsx' })
      .expect(201);
    const created = createResponse.body as ExportJobBody;
    expect(created).toMatchObject({
      project_id: project.id,
      type: 'inventory_items_xlsx',
    });
    expect(['pending', 'processing', 'finished']).toContain(created.status);
    expect(createResponse.body).not.toHaveProperty('file_content');
    expect(createResponse.body).not.toHaveProperty('path');
    expect(createResponse.body).not.toHaveProperty('bucket');

    const finished = await waitForJob(app, token, project.id, created.id);
    expect(finished).toMatchObject({
      status: 'finished',
      mime_type:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      error_code: null,
    });
    expect(finished.file_name).toMatch(/\.xlsx$/);
    expect(finished.size_bytes).toBeGreaterThan(0);
    expect(finished.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(finished.expires_at).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${project.id}/export-jobs?status=finished`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((response) => {
        const body = response.body as unknown as ExportJobListBody;
        expect(body).toMatchObject({
          page: 1,
          page_size: 20,
          total_items: 1,
        });
        expect(body.items[0].id).toBe(created.id);
      });

    const urlResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${project.id}/export-jobs/${created.id}/download-url`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const downloadUrl = urlResponse.body as unknown as ExportJobDownloadUrlBody;
    expect(downloadUrl).toMatchObject({
      download_url: `/api/v1/projects/${project.id}/export-jobs/${created.id}/download`,
      requires_authentication: true,
    });
    expect(downloadUrl.expires_in_seconds).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .get(downloadUrl.download_url)
      .expect(401);

    const download = await request(app.getHttpServer())
      .get(downloadUrl.download_url)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200)
      .expect('Content-Type', /spreadsheetml/)
      .expect('Content-Disposition', /attachment/);
    const content = download.body as Buffer;
    const workbook = XLSX.read(content, { type: 'buffer' });
    expect(workbook.SheetNames).toContain('Itens inventariados');
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets['Itens inventariados'],
    );
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ Descricao: 'Notebook real no XLSX' }),
      ]),
    );

    await request(app.getHttpServer())
      .get(
        `/api/v1/projects/${project.id}/summary?include_exports=true&include_recent_activity=true`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((response) => {
        const body = response.body as unknown as ProjectSummaryBody;
        expect(body.exports).toMatchObject({
          total_export_jobs: 1,
          finished_export_jobs: 1,
        });
        expect(body.recent_activity.last_export_finished_at).toEqual(
          expect.any(String),
        );
      });

    const auditRepo = app.get<Repository<ExportJobAuditLogEntity>>(
      getRepositoryToken(ExportJobAuditLogEntity),
    );
    const operations = (
      await auditRepo.find({ where: { exportJobId: created.id } })
    ).map((audit) => audit.operation);
    expect(operations).toEqual(
      expect.arrayContaining([
        ExportJobAuditOperation.REQUEST,
        ExportJobAuditOperation.START,
        ExportJobAuditOperation.FINISH,
        ExportJobAuditOperation.CREATE_DOWNLOAD_URL,
        ExportJobAuditOperation.DOWNLOAD,
      ]),
    );
  });

  it('rejects formats outside the supported XLSX contract', async () => {
    const projectResponse = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        organization_id: 1,
        company_id: 1,
        name: 'Projeto sem ZIP',
      })
      .expect(201);
    const project = projectResponse.body as ProjectBody;

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/export-jobs`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'project_backup_zip' })
      .expect(400);
  });

  it('fails safely before serializing a workbook above the configured row limit', async () => {
    const previousLimit = process.env.EXPORT_JOB_MAX_ROWS;
    process.env.EXPORT_JOB_MAX_ROWS = '1';
    try {
      const projectResponse = await request(app.getHttpServer())
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({
          organization_id: 1,
          company_id: 1,
          name: 'Projeto com exportacao limitada',
        })
        .expect(201);
      const project = projectResponse.body as ProjectBody;

      for (const plate of ['LIM-001', 'LIM-002']) {
        await request(app.getHttpServer())
          .post(`/api/v1/projects/${project.id}/inventory-items`)
          .set('Authorization', `Bearer ${token}`)
          .send({ old_plate: plate, description: `Item ${plate}` })
          .expect(201);
      }

      const createResponse = await request(app.getHttpServer())
        .post(`/api/v1/projects/${project.id}/export-jobs`)
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'inventory_items_xlsx' })
        .expect(201);
      const created = createResponse.body as ExportJobBody;
      const failed = await waitForTerminalJob(
        app,
        token,
        project.id,
        created.id,
      );
      expect(failed).toMatchObject({
        status: 'failed',
        error_code: 'EXPORT_ROW_LIMIT_EXCEEDED',
      });
    } finally {
      if (previousLimit === undefined) delete process.env.EXPORT_JOB_MAX_ROWS;
      else process.env.EXPORT_JOB_MAX_ROWS = previousLimit;
    }
  });

  it('expires retained bytes in the background without a client read', async () => {
    const projectResponse = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        organization_id: 1,
        company_id: 1,
        name: 'Projeto com exportacao expirada',
      })
      .expect(201);
    const project = projectResponse.body as ProjectBody;
    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/export-jobs`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'inventory_items_xlsx' })
      .expect(201);
    const created = createResponse.body as ExportJobBody;
    await waitForJob(app, token, project.id, created.id);

    const jobs = app.get<Repository<ExportJobEntity>>(
      getRepositoryToken(ExportJobEntity),
    );
    await jobs.update(created.id, { expiresAt: new Date(Date.now() - 1000) });

    const expired = await waitForStoredStatus(
      jobs,
      created.id,
      ExportJobStatus.EXPIRED,
    );
    expect(expired.fileContent).toBeNull();
    const auditRepo = app.get<Repository<ExportJobAuditLogEntity>>(
      getRepositoryToken(ExportJobAuditLogEntity),
    );
    expect(
      await auditRepo.count({
        where: {
          exportJobId: created.id,
          operation: ExportJobAuditOperation.EXPIRE,
        },
      }),
    ).toBe(1);
  });
});

async function waitForJob(
  app: INestApplication,
  token: string,
  projectId: number,
  jobId: number,
): Promise<ExportJobBody> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/export-jobs/${jobId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const job = response.body as ExportJobBody;
    if (job.status === 'finished') return job;
    if (job.status === 'failed') {
      throw new Error(`Export failed: ${job.error_code ?? 'unknown'}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('Export job did not finish in time');
}

async function waitForTerminalJob(
  app: INestApplication,
  token: string,
  projectId: number,
  jobId: number,
): Promise<ExportJobBody> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/export-jobs/${jobId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const job = response.body as ExportJobBody;
    if (['finished', 'failed', 'cancelled', 'expired'].includes(job.status)) {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('Export job did not reach a terminal status in time');
}

async function waitForStoredStatus(
  jobs: Repository<ExportJobEntity>,
  jobId: number,
  status: ExportJobStatus,
): Promise<ExportJobEntity> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const job = await jobs
      .createQueryBuilder('job')
      .addSelect('job.fileContent')
      .where('job.id = :jobId', { jobId })
      .getOneOrFail();
    if (job.status === status) return job;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Export job did not reach stored status ${status}`);
}
