import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  PresignedUrlInput,
  StorageSigner,
  VerifyUploadInput,
} from '../../src/common/storage/storage-signer.port';
import {
  assertUploadConfirmation,
  sha256Hex,
} from '../../src/common/storage/storage-object.policy';

export const TEST_OBJECT_CHECKSUM = 'a'.repeat(64);

// Explicit test double for API integration only, never a runtime storage mode.
// Tests must mark a simulated PUT themselves. Actual bytes/SigV4 are tested
// separately against the SDK mock and the disposable MinIO service.
export class FakeStorage implements StorageSigner {
  private authorized = new Map<string, PresignedUrlInput>();
  private objects = new Map<
    string,
    { sizeBytes: number; checksum: string; mimeType: string }
  >();
  private key(input: PresignedUrlInput) {
    return `/${input.bucket}/${input.path}`;
  }
  async createUploadUrl(input: PresignedUrlInput) {
    sha256Hex(input.checksum);
    if (input.sizeBytes > 50 * 1024 * 1024)
      throw new BadRequestException({
        code: 'STORAGE_INVALID_SIZE',
        message: 'File exceeds configured limit',
      });
    this.authorized.set(this.key(input), input);
    return {
      url: `https://storage.test${this.key(input)}?X-Amz-Signature=mock&operation=PUT`,
      expiresInSeconds: input.expiresInSeconds,
    };
  }
  put(
    url: string,
    overrides: Partial<{
      sizeBytes: number;
      checksum: string;
      mimeType: string;
    }> = {},
  ) {
    const key = new URL(url).pathname;
    const input = this.authorized.get(key);
    if (!input) throw new Error('Unknown simulated upload');
    this.objects.set(key, {
      sizeBytes: input.sizeBytes,
      mimeType: input.mimeType,
      checksum: input.checksum ?? TEST_OBJECT_CHECKSUM,
      ...overrides,
    });
  }
  async verifyUpload(input: VerifyUploadInput) {
    const expected = assertUploadConfirmation(input);
    const object = this.objects.get(this.key(input));
    if (!object)
      throw new NotFoundException({
        code: 'STORAGE_OBJECT_NOT_FOUND',
        message: 'Stored object not found',
      });
    if (
      object.sizeBytes !== input.sizeBytes ||
      object.mimeType !== input.mimeType ||
      (expected && object.checksum !== expected)
    )
      throw new ConflictException({
        code: 'STORAGE_CHECKSUM_MISMATCH',
        message: 'Object metadata mismatch',
      });
    return { sizeBytes: object.sizeBytes, checksum: object.checksum };
  }
  async createDownloadUrl(input: PresignedUrlInput) {
    const object = this.objects.get(this.key(input));
    if (!object)
      throw new NotFoundException({
        code: 'STORAGE_OBJECT_NOT_FOUND',
        message: 'Stored object not found',
      });
    if (input.checksum !== object.checksum)
      throw new ConflictException({
        code: 'STORAGE_CHECKSUM_MISMATCH',
        message: 'Object integrity mismatch',
      });
    return {
      url: `https://storage.test${this.key(input)}?X-Amz-Signature=mock&operation=GET`,
      expiresInSeconds: input.expiresInSeconds,
    };
  }
}
