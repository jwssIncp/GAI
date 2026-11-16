import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '../../../auth/domain/enums/user.enums';
import { InventoryItem } from '../../../inventory-items/domain/entities/inventory-item';
import { Project } from '../../../projects/domain/entities/project';

export interface InventoryItemImageActorContext {
  id: number;
  systemRoles: UserRole[];
  organizationId: number | null;
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

@Injectable()
export class InventoryItemImageScopeService {
  assertCanAccessOrganization(
    actor: InventoryItemImageActorContext,
    organizationId: number,
  ): void {
    if (actor.systemRoles.includes(UserRole.PLATFORM_ADMIN)) {
      return;
    }
    if (actor.organizationId === organizationId) {
      return;
    }
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Você não tem permissão para esta ação.',
    });
  }

  assertItemBelongsToProject(item: InventoryItem, projectId: number): void {
    if (item.projectId !== projectId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'O item de inventário não pertence ao projeto.',
      });
    }
  }

  assertProjectAllowsMutation(project: Project): void {
    if (project.blocksOperationalMutation()) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'A situação do projeto não permite esta operação.',
      });
    }
  }

  assertMimeType(mimeType: string): void {
    if (!ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Tipo de imagem não suportado.',
      });
    }
  }

  assertSize(sizeBytes: number): void {
    const maxBytes = this.maxSizeBytes();
    if (sizeBytes > maxBytes) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `A imagem excede o tamanho máximo de ${maxBytes} bytes.`,
      });
    }
  }

  assertImageLimit(activeCount: number): void {
    const maxImages = this.maxImagesPerItem();
    if (activeCount >= maxImages) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: `O item já tem o limite de ${maxImages} imagens.`,
      });
    }
  }

  maxSizeBytes(): number {
    return parseInt(
      process.env.INVENTORY_ITEM_IMAGE_MAX_SIZE_BYTES ?? '10485760',
      10,
    );
  }

  maxImagesPerItem(): number {
    return parseInt(process.env.INVENTORY_ITEM_IMAGE_MAX_PER_ITEM ?? '3', 10);
  }

  presignedUrlTtlSeconds(): number {
    return parseInt(
      process.env.INVENTORY_ITEM_IMAGE_PRESIGNED_URL_TTL_SECONDS ?? '300',
      10,
    );
  }

  storageBucket(): string {
    return process.env.INVENTORY_ITEM_IMAGE_STORAGE_BUCKET ?? 'gai-local';
  }

  storageProvider(): string {
    return process.env.INVENTORY_ITEM_IMAGE_STORAGE_PROVIDER ?? 's3';
  }

  buildStoragePath(input: {
    organizationId: number;
    inventoryItemId: number;
    storageKey: string;
    originalName: string;
  }): string {
    const safeName = this.safeFileName(input.originalName);
    return [
      `organizations/${input.organizationId}`,
      `inventory-items/${input.inventoryItemId}`,
      `images/${input.storageKey}-${safeName}`,
    ].join('/');
  }

  cleanText(value: string | null | undefined): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  private safeFileName(originalName: string): string {
    const normalized = originalName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return normalized.length > 0 ? normalized.slice(0, 120) : 'image';
  }
}
