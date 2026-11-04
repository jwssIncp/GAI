export interface PresignedUrlInput {
  bucket: string;
  path: string;
  mimeType: string;
  expiresInSeconds: number;
  sizeBytes: number;
  checksum?: string | null;
}

export interface VerifyUploadInput extends PresignedUrlInput {
  createdAt: Date;
  assertion?: { sizeBytes?: number | null; checksum?: string | null };
}

export interface VerifiedStorageObject {
  sizeBytes: number;
  checksum: string;
  versionId?: string;
  etag?: string;
}

export interface PresignedUrlResult {
  url: string;
  expiresInSeconds: number;
}

export const STORAGE_SIGNER = Symbol('STORAGE_SIGNER');

export interface StorageSigner {
  createUploadUrl(input: PresignedUrlInput): Promise<PresignedUrlResult>;
  createDownloadUrl(input: PresignedUrlInput): Promise<PresignedUrlResult>;
  verifyUpload(input: VerifyUploadInput): Promise<VerifiedStorageObject>;
}
