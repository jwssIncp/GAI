import { createHash } from 'crypto';
import { Readable } from 'stream';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { ConfiguredStorageSignerService } from '../../../src/common/storage/configured-storage-signer.service';

import { syntheticStorageEnv } from '../../storage-test.config';

describe('S3 SigV4 adapter (SDK network mocked)', () => {
  const content = Buffer.from('89504e470d0a1a0a00010203', 'hex');
  const checksum = createHash('sha256').update(content).digest('hex');
  const input = {
    bucket: 'gai-isolated-tests',
    path: 'organizations/1/images/synthetic.png',
    mimeType: 'image/png',
    sizeBytes: content.length,
    expiresInSeconds: 300,
  };
  let signer: ConfiguredStorageSignerService;
  let send: jest.SpyInstance;
  const head = () => ({
    ContentLength: content.length,
    ContentType: 'image/png',
    VersionId: 'version-1',
    ETag: 'etag-1',
  });
  const seed = () => {
    send
      .mockResolvedValueOnce(head())
      .mockResolvedValueOnce({ Body: Readable.from([content]) });
  };
  beforeEach(() => {
    jest.replaceProperty(process, 'env', syntheticStorageEnv());
    signer = new ConfiguredStorageSignerService();
    send = jest.spyOn(S3Client.prototype, 'send') as jest.SpyInstance;
  });
  afterEach(() => {
    signer.onModuleDestroy();
    jest.restoreAllMocks();
  });

  it('creates genuine SDK SigV4 URLs bound to MIME, length and expiration', async () => {
    const result = await signer.createUploadUrl({ ...input, checksum });
    const url = new URL(result.url);
    expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain(
      'content-type',
    );
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain(
      'content-length',
    );
    expect(url.searchParams.has('X-GAI-Signature')).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
  it('reads HEAD and exact-version GET and computes full SHA-256 without trusting the client', async () => {
    seed();
    const result = await signer.verifyUpload({
      ...input,
      createdAt: new Date(),
    });
    expect(result).toMatchObject({
      checksum,
      sizeBytes: content.length,
      versionId: 'version-1',
    });
    expect(send.mock.calls[1][0]).toBeInstanceOf(GetObjectCommand);
    expect(send.mock.calls[1][0].input).toMatchObject({
      VersionId: 'version-1',
      IfMatch: 'etag-1',
    });
  });
  it('pins the verified version in the download URL', async () => {
    seed();
    const result = await signer.createDownloadUrl({ ...input, checksum });
    expect(new URL(result.url).searchParams.get('versionId')).toBe('version-1');
  });
  it.each([
    'STORAGE_PROVIDER',
    'STORAGE_BUCKET',
    'AWS_REGION',
    'STORAGE_MAX_SIZE_BYTES',
    'STORAGE_ALLOWED_MIME_TYPES',
    'STORAGE_PRESIGNED_URL_TTL_SECONDS',
  ])('fails closed without explicit %s', (key) => {
    delete process.env[key];
    expect(() => signer.onModuleInit()).toThrow(
      'Missing explicit storage configuration',
    );
  });
  it('does not use a custom endpoint or fallback secret in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => signer.onModuleInit()).toThrow('Production storage');
  });
  it.each([
    { sizeBytes: 0 },
    { sizeBytes: 52428801 },
    { mimeType: 'text/html' },
    { expiresInSeconds: 0 },
    { expiresInSeconds: 301 },
    { path: '../other' },
    { bucket: 'other-bucket' },
    { checksum: 'opaque-old-checksum' },
  ])('rejects invalid upload metadata %j', async (bad) => {
    await expect(
      signer.createUploadUrl({ ...input, ...bad }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('rejects expired confirmation and changed declarations before any storage request', async () => {
    await expect(
      signer.verifyUpload({
        ...input,
        createdAt: new Date(Date.now() - 301000),
      }),
    ).rejects.toMatchObject({ status: 410 });
    await expect(
      signer.verifyUpload({
        ...input,
        createdAt: new Date(),
        assertion: { sizeBytes: 1 },
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(send).not.toHaveBeenCalled();
  });
  it.each([
    { ContentLength: 1 },
    { ContentType: 'text/html' },
    { VersionId: undefined },
  ])('rejects inconsistent object HEAD %j', async (override) => {
    send.mockResolvedValueOnce({ ...head(), ...override });
    await expect(
      signer.verifyUpload({ ...input, createdAt: new Date() }),
    ).rejects.toMatchObject({ status: 409 });
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('rejects a digest that differs from the bytes', async () => {
    seed();
    await expect(
      signer.verifyUpload({
        ...input,
        checksum: 'b'.repeat(64),
        createdAt: new Date(),
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('rejects content with a forged MIME', async () => {
    send.mockResolvedValueOnce(head());
    send.mockResolvedValueOnce({
      Body: Readable.from([Buffer.alloc(content.length, 65)]),
    });
    await expect(
      signer.verifyUpload({ ...input, createdAt: new Date() }),
    ).rejects.toMatchObject({ response: { code: 'STORAGE_CONTENT_MISMATCH' } });
  });
  it.each([Buffer.from('short'), Buffer.alloc(content.length + 1)])(
    'rejects a truncated or oversized body',
    async (body) => {
      send
        .mockResolvedValueOnce(head())
        .mockResolvedValueOnce({ Body: Readable.from([body]) });
      await expect(
        signer.verifyUpload({ ...input, createdAt: new Date() }),
      ).rejects.toMatchObject({ status: 409 });
    },
  );
  it('maps missing objects and remote failures without leaking provider messages', async () => {
    send.mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } });
    await expect(
      signer.verifyUpload({ ...input, createdAt: new Date() }),
    ).rejects.toMatchObject({
      response: { code: 'STORAGE_OBJECT_NOT_FOUND' },
      status: 404,
    });
    send.mockRejectedValueOnce(new Error('sensitive provider detail'));
    await expect(
      signer.verifyUpload({ ...input, createdAt: new Date() }),
    ).rejects.toMatchObject({
      response: {
        code: 'STORAGE_UNAVAILABLE',
        message: 'Storage operation could not be completed',
      },
      status: 503,
    });
  });
  it('blocks legacy objects lacking a verified checksum from download', async () => {
    await expect(signer.createDownloadUrl(input)).rejects.toMatchObject({
      status: 409,
    });
    expect(send).not.toHaveBeenCalled();
  });
});
