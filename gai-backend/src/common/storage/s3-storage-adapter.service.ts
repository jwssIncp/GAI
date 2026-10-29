import { createHash } from 'crypto';
import { Readable } from 'stream';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  PresignedUrlInput,
  PresignedUrlResult,
  StorageSigner,
  VerifiedStorageObject,
  VerifyUploadInput,
} from './storage-signer.port';
import { assertUploadConfirmation, sha256Hex } from './storage-object.policy';

interface Settings {
  region: string;
  buckets: Set<string>;
  endpoint?: string;
  forcePathStyle: boolean;
  maxBytes: number;
  ttl: number;
  mimeTypes: Set<string>;
}

@Injectable()
export class S3StorageAdapterService
  implements StorageSigner, OnModuleInit, OnModuleDestroy
{
  private client?: S3Client;
  private settings?: Settings;

  onModuleInit(): void {
    this.configuration();
  }
  onModuleDestroy(): void {
    this.client?.destroy();
  }

  private configuration(): Settings {
    if (this.settings) return this.settings;
    const env = process.env;
    const required = (key: string): string => {
      const value = env[key]?.trim();
      if (!value)
        throw new Error(`Missing explicit storage configuration: ${key}`);
      return value;
    };
    const positive = (key: string, max: number): number => {
      const value = Number(required(key));
      if (!Number.isSafeInteger(value) || value < 1 || value > max)
        throw new Error(`Invalid storage configuration: ${key}`);
      return value;
    };
    if (required('STORAGE_PROVIDER') !== 's3')
      throw new Error('Only the s3 storage provider is supported');
    const endpoint = env.STORAGE_ENDPOINT_URL?.trim() || undefined;
    const forcePathStyle = env.STORAGE_FORCE_PATH_STYLE === 'true';
    if (
      env.STORAGE_FORCE_PATH_STYLE &&
      !['true', 'false'].includes(env.STORAGE_FORCE_PATH_STYLE)
    )
      throw new Error('Invalid STORAGE_FORCE_PATH_STYLE');
    if (endpoint) {
      const url = new URL(endpoint);
      if (
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== '/' ||
        url.hostname.endsWith('.invalid')
      )
        throw new Error('Invalid storage endpoint');
      if (env.NODE_ENV === 'production')
        throw new Error(
          'Production storage must use the regional AWS S3 endpoint',
        );
      if (
        url.protocol !== 'https:' &&
        !(
          url.protocol === 'http:' &&
          ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
        )
      )
        throw new Error(
          'Storage requires HTTPS except for loopback integration tests',
        );
    }
    const buckets = new Set(
      [
        required('STORAGE_BUCKET'),
        env.INVENTORY_ITEM_IMAGE_STORAGE_BUCKET,
      ].filter((value): value is string => !!value),
    );
    if (
      [...buckets].some(
        (name) => !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(name),
      )
    )
      throw new Error('Invalid storage bucket configuration');
    const mimeTypes = new Set(
      required('STORAGE_ALLOWED_MIME_TYPES')
        .split(',')
        .map((value) => value.trim().toLowerCase()),
    );
    if ([...mimeTypes].some((mime) => !SUPPORTED_MIME_TYPES.has(mime)))
      throw new Error('Unsupported STORAGE_ALLOWED_MIME_TYPES entry');
    this.settings = {
      region: required('AWS_REGION'),
      buckets,
      endpoint,
      forcePathStyle,
      maxBytes: positive('STORAGE_MAX_SIZE_BYTES', 100 * 1024 * 1024),
      ttl: positive('STORAGE_PRESIGNED_URL_TTL_SECONDS', 3600),
      mimeTypes,
    };
    return this.settings;
  }

  private s3(): S3Client {
    const settings = this.configuration();
    return (this.client ??= new S3Client({
      region: settings.region,
      endpoint: settings.endpoint,
      forcePathStyle: settings.forcePathStyle,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      maxAttempts: 2,
      requestHandler: { connectionTimeout: 5000, socketTimeout: 15000 },
    }));
  }

  private validate(input: PresignedUrlInput): void {
    const settings = this.configuration();
    if (
      !settings.buckets.has(input.bucket) ||
      !/^organizations\/\d+\//.test(input.path) ||
      input.path.split('/').some((part) => part === '..' || part === '.')
    )
      throw new BadRequestException({
        code: 'STORAGE_INVALID_KEY',
        message: 'Storage target is not authorized',
      });
    if (
      !Number.isSafeInteger(input.sizeBytes) ||
      input.sizeBytes < 1 ||
      input.sizeBytes > settings.maxBytes
    )
      throw new BadRequestException({
        code: 'STORAGE_INVALID_SIZE',
        message: 'File exceeds the configured size limit',
      });
    if (!settings.mimeTypes.has(input.mimeType.toLowerCase()))
      throw new BadRequestException({
        code: 'STORAGE_UNSUPPORTED_MIME',
        message: 'File MIME type is not permitted',
      });
    if (
      !Number.isInteger(input.expiresInSeconds) ||
      input.expiresInSeconds < 1 ||
      input.expiresInSeconds > settings.ttl
    )
      throw new BadRequestException({
        code: 'STORAGE_INVALID_EXPIRATION',
        message: 'Invalid URL expiration',
      });
    sha256Hex(input.checksum);
  }

  async createUploadUrl(input: PresignedUrlInput): Promise<PresignedUrlResult> {
    this.validate(input);
    return this.operation(async () => ({
      url: await getSignedUrl(
        this.s3(),
        new PutObjectCommand({
          Bucket: input.bucket,
          Key: input.path,
          ContentType: input.mimeType,
          ContentLength: input.sizeBytes,
          ...(input.checksum
            ? {
                ChecksumSHA256: Buffer.from(input.checksum, 'hex').toString(
                  'base64',
                ),
              }
            : {}),
        }),
        {
          expiresIn: input.expiresInSeconds,
          signableHeaders: new Set(['content-type', 'content-length']),
        },
      ),
      expiresInSeconds: input.expiresInSeconds,
    }));
  }

  async verifyUpload(input: VerifyUploadInput): Promise<VerifiedStorageObject> {
    this.validate(input);
    const checksum = assertUploadConfirmation(input);
    const result = await this.inspect({ ...input, checksum });
    assertUploadConfirmation(input);
    return result;
  }

  async createDownloadUrl(
    input: PresignedUrlInput,
  ): Promise<PresignedUrlResult> {
    this.validate(input);
    if (!sha256Hex(input.checksum))
      throw new ConflictException({
        code: 'STORAGE_UNVERIFIED_OBJECT',
        message: 'Object requires integrity verification before download',
      });
    const verified = await this.inspect(input);
    return this.operation(async () => ({
      // Pin the exact version that was verified, including during replayed PUTs.
      url: await getSignedUrl(
        this.s3(),
        new GetObjectCommand({
          Bucket: input.bucket,
          Key: input.path,
          VersionId: verified.versionId,
          ResponseContentDisposition: 'attachment',
          ResponseContentType: input.mimeType,
        }),
        { expiresIn: input.expiresInSeconds },
      ),
      expiresInSeconds: input.expiresInSeconds,
    }));
  }

  private async inspect(
    input: PresignedUrlInput,
  ): Promise<VerifiedStorageObject> {
    return this.operation(async () => {
      const head = await this.s3().send(
        new HeadObjectCommand({ Bucket: input.bucket, Key: input.path }),
      );
      const normalize = (mime: string | undefined) =>
        mime
          ?.split(';')[0]
          .trim()
          .toLowerCase()
          .replace('image/jpg', 'image/jpeg');
      if (head.ContentLength !== Number(input.sizeBytes))
        throw new ConflictException({
          code: 'STORAGE_SIZE_MISMATCH',
          message: 'Stored object size differs from the authorized upload',
        });
      if (normalize(head.ContentType) !== normalize(input.mimeType))
        throw new ConflictException({
          code: 'STORAGE_MIME_MISMATCH',
          message: 'Stored object MIME differs from the authorized upload',
        });
      if (!head.VersionId || head.VersionId === 'null')
        throw new ConflictException({
          code: 'STORAGE_VERSIONING_REQUIRED',
          message: 'Storage bucket versioning must be enabled',
        });
      const object = await this.s3().send(
        new GetObjectCommand({
          Bucket: input.bucket,
          Key: input.path,
          VersionId: head.VersionId,
          IfMatch: head.ETag,
        }),
      );
      if (!object.Body)
        throw new ConflictException({
          code: 'STORAGE_EMPTY_RESPONSE',
          message: 'Object body unavailable',
        });
      const hash = createHash('sha256');
      let sizeBytes = 0;
      let prefix = Buffer.alloc(0);
      try {
        for await (const part of object.Body as AsyncIterable<Uint8Array>) {
          const chunk = Buffer.from(part);
          sizeBytes += chunk.length;
          if (
            sizeBytes > input.sizeBytes ||
            sizeBytes > this.configuration().maxBytes
          )
            throw new ConflictException({
              code: 'STORAGE_SIZE_MISMATCH',
              message: 'Object exceeds authorized size',
            });
          hash.update(chunk);
          if (prefix.length < 4096)
            prefix = Buffer.concat([
              prefix,
              chunk.subarray(0, 4096 - prefix.length),
            ]);
        }
      } finally {
        if (object.Body instanceof Readable) object.Body.destroy();
      }
      const checksum = hash.digest('hex');
      if (sizeBytes !== Number(input.sizeBytes))
        throw new ConflictException({
          code: 'STORAGE_SIZE_MISMATCH',
          message: 'Incomplete object body',
        });
      if (input.checksum && sha256Hex(input.checksum) !== checksum)
        throw new ConflictException({
          code: 'STORAGE_CHECKSUM_MISMATCH',
          message: 'Stored object checksum differs from the authorized upload',
        });
      if (!matchesMime(normalize(input.mimeType)!, prefix))
        throw new ConflictException({
          code: 'STORAGE_CONTENT_MISMATCH',
          message: 'File content does not match its MIME type',
        });
      return {
        sizeBytes,
        checksum,
        versionId: head.VersionId,
        etag: head.ETag,
      };
    });
  }

  private async operation<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const failure = error as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
      };
      if (
        ['NotFound', 'NoSuchKey', 'NoSuchVersion'].includes(
          failure.name ?? '',
        ) ||
        failure.$metadata?.httpStatusCode === 404
      )
        throw new NotFoundException({
          code: 'STORAGE_OBJECT_NOT_FOUND',
          message: 'Stored object not found',
        });
      throw new ServiceUnavailableException({
        code: 'STORAGE_UNAVAILABLE',
        message: 'Storage operation could not be completed',
      });
    }
  }
}

const SUPPORTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/json',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
]);

function matchesMime(mime: string, prefix: Buffer): boolean {
  if (mime === 'image/png')
    return prefix.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  if (mime === 'image/jpeg')
    return prefix.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'));
  if (mime === 'image/webp')
    return (
      prefix.subarray(0, 4).toString() === 'RIFF' &&
      prefix.subarray(8, 12).toString() === 'WEBP'
    );
  if (mime === 'application/pdf')
    return prefix.subarray(0, 5).toString() === '%PDF-';
  if (mime === 'application/zip' || mime.endsWith('spreadsheetml.sheet'))
    return prefix.subarray(0, 4).equals(Buffer.from('504b0304', 'hex'));
  if (mime === 'application/json') {
    const text = prefix
      .toString('utf8')
      .replace(/^\uFEFF/, '')
      .trimStart();
    return text.startsWith('{') || text.startsWith('[');
  }
  if (mime.startsWith('text/'))
    return !prefix.includes(0) && !prefix.toString('utf8').includes('\uFFFD');
  return mime === 'application/octet-stream';
}
