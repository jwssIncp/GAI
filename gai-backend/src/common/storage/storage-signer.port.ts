export interface PresignedUrlInput {
  bucket: string;
  path: string;
  mimeType: string;
  expiresInSeconds: number;
}

export interface PresignedUrlResult {
  url: string;
  expiresInSeconds: number;
}

export const STORAGE_SIGNER = Symbol('STORAGE_SIGNER');

export interface StorageSigner {
  createUploadUrl(input: PresignedUrlInput): Promise<PresignedUrlResult>;
  createDownloadUrl(input: PresignedUrlInput): Promise<PresignedUrlResult>;
}
