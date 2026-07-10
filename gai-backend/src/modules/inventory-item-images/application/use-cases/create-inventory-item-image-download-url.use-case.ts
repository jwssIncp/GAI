import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  STORAGE_SIGNER,
  type StorageSigner,
} from '../../../../common/storage/storage-signer.port';
import { InventoryItemImageAuditOperation } from '../../domain/enums/inventory-item-image-audit-operation.enum';
import { InventoryItemImageStatus } from '../../domain/enums/inventory-item-image-status.enum';
import {
  INVENTORY_ITEM_IMAGE_REPOSITORY,
  type InventoryItemImageRepository,
} from '../../domain/ports/inventory-item-image.repository.port';
import {
  InventoryItemImageDownloadUrlResponseDto,
  InventoryItemImageResponseDto,
} from '../dto/inventory-item-image-response.dto';
import {
  InventoryItemImageActorContext,
  InventoryItemImageScopeService,
} from '../services/inventory-item-image-scope.service';
import { GetInventoryItemImageUseCase } from './get-inventory-item-image.use-case';

@Injectable()
export class CreateInventoryItemImageDownloadUrlUseCase {
  constructor(
    @Inject(INVENTORY_ITEM_IMAGE_REPOSITORY)
    private readonly repository: InventoryItemImageRepository,
    @Inject(STORAGE_SIGNER)
    private readonly storageSigner: StorageSigner,
    private readonly getImage: GetInventoryItemImageUseCase,
    private readonly scope: InventoryItemImageScopeService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CreateInventoryItemImageDownloadUrlUseCase.name);
  }

  async execute(
    imageId: number,
    actor: InventoryItemImageActorContext,
    expected?: { projectId?: number; itemId?: number },
  ): Promise<InventoryItemImageDownloadUrlResponseDto> {
    const image = await this.getImage.findAndAuthorize(
      imageId,
      actor,
      expected,
    );
    if (image.status !== InventoryItemImageStatus.UPLOADED) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Only uploaded images can be downloaded',
      });
    }

    const signed = await this.storageSigner.createDownloadUrl({
      bucket: image.bucket,
      path: image.path,
      mimeType: image.mimeType,
      expiresInSeconds: this.scope.presignedUrlTtlSeconds(),
    });

    await this.repository.audit({
      inventoryItemImageId: image.id,
      organizationId: image.organizationId,
      inventoryItemId: image.inventoryItemId,
      operation: InventoryItemImageAuditOperation.DOWNLOAD_URL,
      performedBy: actor.id,
      changes: {
        download_url_generated: { before: false, after: true },
      },
    });

    this.logger.info({
      operation: 'CREATE_INVENTORY_ITEM_IMAGE_DOWNLOAD_URL',
      inventoryItemImageId: image.id,
      inventoryItemId: image.inventoryItemId,
      organizationId: image.organizationId,
      result: 'SUCCESS',
    });

    return {
      image: InventoryItemImageResponseDto.fromDomain(image),
      download_url: signed.url,
      expires_in_seconds: signed.expiresInSeconds,
    };
  }
}
