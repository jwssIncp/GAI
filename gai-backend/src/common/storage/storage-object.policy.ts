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
      message: 'checksum: deve ser um hash SHA-256 em hexadecimal.',
    });
  return value.toLowerCase();
}

export function assertUploadConfirmation(
  input: VerifyUploadInput,
): string | undefined {
  if (Date.now() >= input.createdAt.getTime() + input.expiresInSeconds * 1000) {
    throw new GoneException({
      code: 'STORAGE_UPLOAD_EXPIRED',
      message: 'A autorização de envio expirou; peça um novo envio.',
    });
  }
  if (
    input.assertion?.sizeBytes != null &&
    input.assertion.sizeBytes !== Number(input.sizeBytes)
  ) {
    throw new ConflictException({
      code: 'STORAGE_SIZE_MISMATCH',
      message: 'O tamanho confirmado difere do envio autorizado.',
    });
  }
  const declared = sha256Hex(input.checksum);
  const asserted = sha256Hex(input.assertion?.checksum);
  if (declared && asserted && declared !== asserted) {
    throw new ConflictException({
      code: 'STORAGE_CHECKSUM_MISMATCH',
      message: 'A soma de verificação confirmada difere do envio autorizado.',
    });
  }
  return declared ?? asserted;
}
