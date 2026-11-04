import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  STORAGE_SIGNER,
  type StorageSigner,
} from '../../../../common/storage/storage-signer.port';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from '../../../projects/domain/ports/project.repository.port';
import { InventoryItemImageAuditOperation } from '../../domain/enums/inventory-item-image-audit-operation.enum';
import { InventoryItemImageStatus } from '../../domain/enums/inventory-item-image-status.enum';
import {
  INVENTORY_ITEM_IMAGE_REPOSITORY,
  type InventoryItemImageRepository,
} from '../../domain/ports/inventory-item-image.repository.port';
import { ConfirmInventoryItemImageUploadDto } from '../dto/inventory-item-image-inputs';
import { InventoryItemImageResponseDto } from '../dto/inventory-item-image-response.dto';
import {
  InventoryItemImageActorContext,
  InventoryItemImageScopeService,
} from '../services/inventory-item-image-scope.service';
import { GetInventoryItemImageUseCase } from './get-inventory-item-image.use-case';

@Injectable()
export class ConfirmInventoryItemImageUploadUseCase {
  constructor(
    @Inject(INVENTORY_ITEM_IMAGE_REPOSITORY)
    private readonly repository: InventoryItemImageRepository,
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepository,
    private readonly getImage: GetInventoryItemImageUseCase,
    private readonly scope: InventoryItemImageScopeService,
    private readonly logger: PinoLogger,
    @Inject(STORAGE_SIGNER) private readonly storage: StorageSigner,
  ) {
    this.logger.setContext(ConfirmInventoryItemImageUploadUseCase.name);
  }

  async execute(
    projectId: number,
    itemId: number,
    imageId: number,
    dto: ConfirmInventoryItemImageUploadDto,
    actor: InventoryItemImageActorContext,
  ): Promise<InventoryItemImageResponseDto> {
    const project = await this.projects.findById(projectId);
    if (!project) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Project status blocks this operation',
      });
    }
    this.scope.assertProjectAllowsMutation(project);
    if (dto.size_bytes !== undefined && dto.size_bytes !== null) {
      this.scope.assertSize(dto.size_bytes);
    }

    const image = await this.getImage.findAndAuthorize(imageId, actor, {
      projectId,
      itemId,
    });
    if (image.status !== InventoryItemImageStatus.PENDING_UPLOAD)
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Only pending upload images can be confirmed',
      });
    const props = image.toProps();
    const verified = await this.storage.verifyUpload({
      bucket: image.bucket,
      path: image.path,
      mimeType: image.mimeType,
      sizeBytes: Number(props.sizeBytes),
      checksum: props.checksum,
      createdAt: props.createdAt,
      expiresInSeconds: this.scope.presignedUrlTtlSeconds(),
      assertion: { sizeBytes: dto.size_bytes, checksum: dto.checksum },
    });
    let changes: Record<string, { before: unknown; after: unknown }>;
    try {
      changes = image.confirmUpload(actor.id, {
        checksum: verified.checksum,
        sizeBytes: verified.sizeBytes,
      });
    } catch (error) {
      throw new ConflictException({
        code: 'CONFLICT',
        message:
          error instanceof Error
            ? error.message
            : 'Inventory item image upload cannot be confirmed',
      });
    }

    const saved = await this.repository.saveWithAudit(image, {
      inventoryItemImageId: image.id,
      organizationId: image.organizationId,
      inventoryItemId: image.inventoryItemId,
      operation: InventoryItemImageAuditOperation.CONFIRM_UPLOAD,
      performedBy: actor.id,
      changes,
    });

    this.logger.info({
      operation: 'CONFIRM_INVENTORY_ITEM_IMAGE_UPLOAD',
      inventoryItemImageId: saved.id,
      inventoryItemId: saved.inventoryItemId,
      organizationId: saved.organizationId,
      result: 'SUCCESS',
    });

    return InventoryItemImageResponseDto.fromDomain(saved);
  }
}
