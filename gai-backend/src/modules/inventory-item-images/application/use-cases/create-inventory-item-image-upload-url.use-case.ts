import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  STORAGE_SIGNER,
  type StorageSigner,
} from '../../../../common/storage/storage-signer.port';
import {
  INVENTORY_ITEM_REPOSITORY,
  type InventoryItemRepository,
} from '../../../inventory-items/domain/ports/inventory-item.repository.port';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from '../../../projects/domain/ports/project.repository.port';
import { InventoryItemImage } from '../../domain/entities/inventory-item-image';
import { InventoryItemImageAuditOperation } from '../../domain/enums/inventory-item-image-audit-operation.enum';
import { InventoryItemImageStatus } from '../../domain/enums/inventory-item-image-status.enum';
import {
  INVENTORY_ITEM_IMAGE_REPOSITORY,
  type InventoryItemImageRepository,
} from '../../domain/ports/inventory-item-image.repository.port';
import { CreateInventoryItemImageUploadDto } from '../dto/inventory-item-image-inputs';
import {
  InventoryItemImageResponseDto,
  InventoryItemImageUploadUrlResponseDto,
} from '../dto/inventory-item-image-response.dto';
import {
  InventoryItemImageActorContext,
  InventoryItemImageScopeService,
} from '../services/inventory-item-image-scope.service';

@Injectable()
export class CreateInventoryItemImageUploadUrlUseCase {
  constructor(
    @Inject(INVENTORY_ITEM_IMAGE_REPOSITORY)
    private readonly repository: InventoryItemImageRepository,
    @Inject(INVENTORY_ITEM_REPOSITORY)
    private readonly inventoryItems: InventoryItemRepository,
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepository,
    @Inject(STORAGE_SIGNER)
    private readonly storageSigner: StorageSigner,
    private readonly scope: InventoryItemImageScopeService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CreateInventoryItemImageUploadUrlUseCase.name);
  }

  async execute(
    projectId: number,
    itemId: number,
    dto: CreateInventoryItemImageUploadDto,
    actor: InventoryItemImageActorContext,
  ): Promise<InventoryItemImageUploadUrlResponseDto> {
    const item = await this.inventoryItems.findById(itemId);
    if (!item) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Inventory item not found',
      });
    }
    this.scope.assertItemBelongsToProject(item, projectId);
    this.scope.assertCanAccessOrganization(actor, item.organizationId);

    const project = await this.projects.findById(projectId);
    if (!project) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Project not found',
      });
    }
    this.scope.assertProjectAllowsMutation(project);
    this.scope.assertMimeType(dto.mime_type);
    this.scope.assertSize(dto.size_bytes);
    this.scope.assertImageLimit(
      await this.repository.countActiveByItem(itemId),
    );

    const originalName = this.scope.cleanText(dto.original_name);
    if (!originalName) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'original_name is required',
      });
    }

    const now = new Date();
    const image = new InventoryItemImage({
      id: 0,
      organizationId: item.organizationId,
      inventoryItemId: item.id,
      storageProvider: this.scope.storageProvider(),
      bucket: this.scope.storageBucket(),
      path: this.scope.buildStoragePath({
        organizationId: item.organizationId,
        inventoryItemId: item.id,
        storageKey: randomUUID(),
        originalName,
      }),
      originalName,
      mimeType: dto.mime_type.toLowerCase(),
      sizeBytes: dto.size_bytes,
      checksum: this.scope.cleanText(dto.checksum),
      status: InventoryItemImageStatus.PENDING_UPLOAD,
      uploadedById: actor.id,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    const saved = await this.repository.saveWithAudit(image, {
      inventoryItemImageId: 0,
      organizationId: image.organizationId,
      inventoryItemId: image.inventoryItemId,
      operation: InventoryItemImageAuditOperation.CREATE_UPLOAD_URL,
      performedBy: actor.id,
      changes: {
        status: { before: null, after: image.status },
        original_name: { before: null, after: originalName },
        mime_type: { before: null, after: image.mimeType },
        size_bytes: { before: null, after: image.toProps().sizeBytes },
      },
    });

    const signed = await this.storageSigner.createUploadUrl({
      bucket: saved.bucket,
      path: saved.path,
      mimeType: saved.mimeType,
      expiresInSeconds: this.scope.presignedUrlTtlSeconds(),
    });

    this.logger.info({
      operation: 'CREATE_INVENTORY_ITEM_IMAGE_UPLOAD_URL',
      inventoryItemImageId: saved.id,
      inventoryItemId: saved.inventoryItemId,
      organizationId: saved.organizationId,
      result: 'SUCCESS',
    });

    return {
      image: InventoryItemImageResponseDto.fromDomain(saved),
      upload_url: signed.url,
      expires_in_seconds: signed.expiresInSeconds,
    };
  }
}
