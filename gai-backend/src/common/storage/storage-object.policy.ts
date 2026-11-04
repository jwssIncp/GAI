import {
  BadRequestException,
  ConflictException,
  GoneException,
} from '@nestjs/common';
import { VerifyUploadInput } from './storage-signer.port';

export function sha256Hex(
  value: string | null | undefined,
): string | undefined {
  if (value == null || value === '') return undefined;
  if (!/^[a-fA-F0-9]{64}$/.test(value))
    throw new BadRequestException({
      code: 'STORAGE_INVALID_CHECKSUM',
      message: 'checksum must be a SHA-256 hexadecimal digest',
    });
  return value.toLowerCase();
}

export function assertUploadConfirmation(
  input: VerifyUploadInput,
): string | undefined {
  if (Date.now() >= input.createdAt.getTime() + input.expiresInSeconds * 1000) {
    throw new GoneException({
      code: 'STORAGE_UPLOAD_EXPIRED',
      message: 'Upload authorization expired; request a new upload',
    });
  }
  if (
    input.assertion?.sizeBytes != null &&
    input.assertion.sizeBytes !== Number(input.sizeBytes)
  ) {
    throw new ConflictException({
      code: 'STORAGE_SIZE_MISMATCH',
      message: 'Confirmed size differs from the authorized upload',
    });
  }
  const declared = sha256Hex(input.checksum);
  const asserted = sha256Hex(input.assertion?.checksum);
  if (declared && asserted && declared !== asserted) {
    throw new ConflictException({
      code: 'STORAGE_CHECKSUM_MISMATCH',
      message: 'Confirmed checksum differs from the authorized upload',
    });
  }
  return declared ?? asserted;
}
