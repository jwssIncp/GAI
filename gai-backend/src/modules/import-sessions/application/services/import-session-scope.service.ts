import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '../../../auth/domain/enums/user.enums';
import { Project } from '../../../projects/domain/entities/project';

export interface ImportSessionActorContext {
  id: number;
  systemRoles: UserRole[];
  organizationId: number | null;
  /** Field account confined to linked projects: only its own sessions. */
  confined?: boolean;
}

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const FILE_TYPE_MIME: Record<string, string[]> = {
  image: IMAGE_MIME_TYPES,
  raw_backup: ['application/zip', 'application/json'],
  raw_payload: ['application/json'],
};

@Injectable()
export class ImportSessionScopeService {
  assertCanAccessOrganization(
    actor: ImportSessionActorContext,
    organizationId: number,
  ): void {
    if (
      actor.systemRoles.includes(UserRole.PLATFORM_ADMIN) ||
      actor.organizationId === organizationId
    ) {
      return;
    }
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Insufficient permissions',
    });
  }

  assertProjectAllowsMutation(project: Project): void {
    if (!project.blocksOperationalMutation()) return;
    throw new ConflictException({
      code: 'CONFLICT',
      message: 'Project status blocks this operation',
    });
  }

  sessionTtlHours(): number {
    return Number(process.env.IMPORT_SESSION_TTL_HOURS ?? 24);
  }

  maxItemsPerPayload(): number {
    return Number(process.env.IMPORT_PAYLOAD_MAX_ITEMS ?? 10000);
  }

  maxImagesPerPayload(): number {
    return Number(process.env.IMPORT_PAYLOAD_MAX_IMAGES ?? 50000);
  }

  storageProvider(): string {
    return process.env.STORAGE_PROVIDER ?? 's3';
  }

  storageBucket(): string {
    return process.env.STORAGE_BUCKET ?? 'gai-local';
  }

  presignedUrlTtlSeconds(): number {
    return Number(process.env.STORAGE_PRESIGNED_URL_TTL_SECONDS ?? 300);
  }

  /** Mobile reconciliation sessions (legacy app expects 7 days). */
  mobileSessionTtlHours(): number {
    return Number(process.env.MOBILE_IMPORT_SESSION_TTL_HOURS ?? 168);
  }

  /** Upload/confirm window per file type: large backups get a longer one. */
  uploadTtlSeconds(type: string): number {
    if (type !== 'raw_backup') return this.presignedUrlTtlSeconds();
    return Math.max(
      this.presignedUrlTtlSeconds(),
      Number(process.env.IMPORT_BACKUP_UPLOAD_TTL_SECONDS ?? 1800),
    );
  }

  /** Type-specific MIME and size rules on top of the storage allowlist. */
  assertFileForType(type: string, mimeType: string, sizeBytes: number): void {
    const allowed = FILE_TYPE_MIME[type];
    if (allowed && !allowed.includes(mimeType.toLowerCase()))
      throw new BadRequestException({
        code: 'INVALID_IMPORT_FILE',
        message: `Tipo de arquivo não permitido para ${type}.`,
      });
    const max =
      type === 'image'
        ? Number(process.env.INVENTORY_ITEM_IMAGE_MAX_SIZE_BYTES ?? 10485760)
        : type === 'raw_backup'
          ? Number(process.env.IMPORT_BACKUP_MAX_SIZE_BYTES ?? 104857600)
          : null;
    if (max !== null && sizeBytes > max)
      throw new BadRequestException({
        code: 'INVALID_IMPORT_FILE',
        message: `Arquivo excede o limite de ${max} bytes para ${type}.`,
      });
  }

  maxImagesPerItem(): number {
    return Number(process.env.INVENTORY_ITEM_IMAGE_MAX_PER_ITEM ?? 3);
  }

  /** Items applied per transaction: bounds how long the project write lock
   * (sync counter) is held by a large payload. */
  itemsPerTransaction(): number {
    return Math.max(1, Number(process.env.IMPORT_ITEMS_PER_TRANSACTION ?? 100));
  }

  normalizePlate(value: string | null | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const normalized = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return normalized.length === 0 ? null : normalized;
  }

  cleanText(value: string | null | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  buildImportFilePath(input: {
    organizationId: number;
    sessionId: number;
    storageKey: string;
    originalName: string;
  }): string {
    const safeName = input.originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `organizations/${input.organizationId}/imports/${input.sessionId}/${input.storageKey}-${safeName}`;
  }
}
