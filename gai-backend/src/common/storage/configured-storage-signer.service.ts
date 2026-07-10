import { createHmac } from 'crypto';
import { Injectable } from '@nestjs/common';
import {
  PresignedUrlInput,
  PresignedUrlResult,
  StorageSigner,
} from './storage-signer.port';

@Injectable()
export class ConfiguredStorageSignerService implements StorageSigner {
  createUploadUrl(input: PresignedUrlInput): Promise<PresignedUrlResult> {
    return Promise.resolve(this.sign('PUT', input));
  }

  createDownloadUrl(input: PresignedUrlInput): Promise<PresignedUrlResult> {
    return Promise.resolve(this.sign('GET', input));
  }

  private sign(
    method: 'GET' | 'PUT',
    input: PresignedUrlInput,
  ): PresignedUrlResult {
    const endpoint =
      process.env.STORAGE_ENDPOINT_URL ?? 'https://s3.local.invalid';
    const expiresAt = Math.floor(Date.now() / 1000) + input.expiresInSeconds;
    const key = `${input.bucket}/${input.path}`;
    const secret = process.env.STORAGE_SIGNING_SECRET ?? 'local-dev-secret';
    const signature = createHmac('sha256', secret)
      .update(`${method}:${key}:${input.mimeType}:${expiresAt}`)
      .digest('hex');
    const url = new URL(`${endpoint.replace(/\/$/, '')}/${key}`);
    url.searchParams.set('X-GAI-Method', method);
    url.searchParams.set('X-GAI-Expires', String(expiresAt));
    url.searchParams.set('X-GAI-Signature', signature);
    return { url: url.toString(), expiresInSeconds: input.expiresInSeconds };
  }
}
