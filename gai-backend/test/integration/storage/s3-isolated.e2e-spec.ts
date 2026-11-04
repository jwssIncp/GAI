import { createHash, randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import {
  S3Client,
  CreateBucketCommand,
  PutBucketVersioningCommand,
  HeadObjectCommand,
  PutObjectCommand,
  BucketAlreadyOwnedByYou,
} from '@aws-sdk/client-s3';
import request from 'supertest';
import { ConfiguredStorageSignerService } from '../../../src/common/storage/configured-storage-signer.service';
import { syntheticStorageEnv } from '../../storage-test.config';
import {
  createTestApp,
  seedTestData,
  loginAsOrgAdmin,
} from '../test-app.helper';

// Fixed loopback target and synthetic credentials; never read a test target
// from application credentials, bucket names, AWS profiles or production env.
const isolated =
  process.env.GAI_TEST_S3_DISPOSABLE === '1' ? describe : describe.skip;
isolated('S3-compatible isolated integration: real PUT / HEAD / GET', () => {
  let client: S3Client;
  let signer: ConfiguredStorageSignerService;
  let app: INestApplication;
  let token: string;
  let images: string;
  const bucket = 'gai-isolated-tests';
  const png = Buffer.from('89504e470d0a1a0a00010203', 'hex');
  const checksum = createHash('sha256').update(png).digest('hex');
  const input = () => ({
    bucket,
    path: `organizations/1/isolated/${randomUUID()}.png`,
    mimeType: 'image/png',
    sizeBytes: png.length,
    expiresInSeconds: 300,
  });
  beforeAll(async () => {
    jest.replaceProperty(process, 'env', syntheticStorageEnv());
    client = new S3Client({
      region: 'us-east-1',
      endpoint: 'http://127.0.0.1:33318',
      forcePathStyle: true,
      credentials: {
        accessKeyId: 'gai-validation',
        secretAccessKey: 'gai-validation-only',
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
    });
    await client
      .send(new CreateBucketCommand({ Bucket: bucket }))
      .catch((error: unknown) => {
        if (!(error instanceof BucketAlreadyOwnedByYou)) throw error;
      });
    await client.send(
      new PutBucketVersioningCommand({
        Bucket: bucket,
        VersioningConfiguration: { Status: 'Enabled' },
      }),
    );
    signer = new ConfiguredStorageSignerService();
    app = await createTestApp(signer);
    await seedTestData(app);
    token = await loginAsOrgAdmin(app);
    const project = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        organization_id: 1,
        company_id: 1,
        name: 'Isolated S3 synthetic project',
      })
      .expect(201);
    const item = await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.body.id}/inventory-items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Synthetic S3 evidence' })
      .expect(201);
    images = `/api/v1/projects/${project.body.id}/inventory-items/${item.body.id}/images`;
  });
  afterAll(async () => {
    await app?.close();
    signer?.onModuleDestroy();
    client?.destroy();
    jest.restoreAllMocks();
  });
  async function put(url: string, body = png, mime = 'image/png') {
    return fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': mime, 'Content-Length': String(body.length) },
      body,
    });
  }
  it('signs, uploads, HEADs, verifies and downloads the exact bytes from a versioned object', async () => {
    const metadata = input();
    const upload = await signer.createUploadUrl({ ...metadata, checksum });
    expect((await put(upload.url)).status).toBe(200);
    const head = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: metadata.path }),
    );
    expect(head.ContentLength).toBe(png.length);
    expect(head.VersionId).toBeTruthy();
    const verified = await signer.verifyUpload({
      ...metadata,
      createdAt: new Date(),
      assertion: { checksum },
    });
    expect(verified.checksum).toBe(checksum);
    const download = await signer.createDownloadUrl({
      ...metadata,
      checksum: verified.checksum,
    });
    const response = await fetch(download.url);
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(png);
    expect(new URL(download.url).searchParams.get('versionId')).toBe(
      head.VersionId,
    );
  });
  it('does not confirm an absent object', async () => {
    await expect(
      signer.verifyUpload({ ...input(), createdAt: new Date() }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('rejects a mismatched MIME in a signed PUT', async () => {
    const upload = await signer.createUploadUrl(input());
    expect((await put(upload.url, png, 'text/html')).status).toBe(403);
  });
  it('rejects forged file content despite correct MIME metadata', async () => {
    const metadata = input();
    const upload = await signer.createUploadUrl(metadata);
    expect((await put(upload.url, Buffer.alloc(png.length, 65))).status).toBe(
      200,
    );
    await expect(
      signer.verifyUpload({ ...metadata, createdAt: new Date() }),
    ).rejects.toMatchObject({ response: { code: 'STORAGE_CONTENT_MISMATCH' } });
  });
  it('detects a replacement after confirmation and keeps previously issued URLs pinned', async () => {
    const metadata = input();
    const upload = await signer.createUploadUrl(metadata);
    await put(upload.url);
    const download = await signer.createDownloadUrl({ ...metadata, checksum });
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: metadata.path,
        ContentType: 'image/png',
        Body: Buffer.alloc(png.length, 65),
      }),
    );
    const previous = await fetch(download.url);
    expect(Buffer.from(await previous.arrayBuffer())).toEqual(png);
    await expect(
      signer.createDownloadUrl({ ...metadata, checksum }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('the actual server rejects a presigned PUT after expiration', async () => {
    const upload = await signer.createUploadUrl({
      ...input(),
      expiresInSeconds: 1,
    });
    await new Promise((resolve) => setTimeout(resolve, 2200));
    expect((await put(upload.url)).status).toBe(403);
  });
  it('verifies the complete Nest API image lifecycle against actual object storage', async () => {
    const upload = await request(app.getHttpServer())
      .post(`${images}/upload-url`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        original_name: 'synthetic.png',
        mime_type: 'image/png',
        size_bytes: png.length,
      })
      .expect(201);
    const path = `${images}/${upload.body.image.id}`;
    await request(app.getHttpServer())
      .post(`${path}/confirm-upload`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(404);
    await request(app.getHttpServer())
      .post(`${path}/download-url`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
    expect((await put(upload.body.upload_url)).status).toBe(200);
    const confirmed = await request(app.getHttpServer())
      .post(`${path}/confirm-upload`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    expect(confirmed.body.checksum).toBe(checksum);
    const download = await request(app.getHttpServer())
      .post(`${path}/download-url`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const response = await fetch(download.body.download_url as string);
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(png);
    await request(app.getHttpServer()).post(`${path}/download-url`).expect(401);
  });
});
