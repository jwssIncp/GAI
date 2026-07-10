import {
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
}

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
