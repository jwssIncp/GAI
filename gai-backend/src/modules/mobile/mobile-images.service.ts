import { Injectable } from '@nestjs/common';
import { DataSource, Not } from 'typeorm';
import type { AuthenticatedUser } from '../auth/presentation/guards/session-auth.guard';
import { InventoryItemImageResponseDto } from '../inventory-item-images/application/dto/inventory-item-image-response.dto';
import { ConfirmInventoryItemImageUploadUseCase } from '../inventory-item-images/application/use-cases/confirm-inventory-item-image-upload.use-case';
import { CreateInventoryItemImageDownloadUrlUseCase } from '../inventory-item-images/application/use-cases/create-inventory-item-image-download-url.use-case';
import { CreateInventoryItemImageUploadUrlUseCase } from '../inventory-item-images/application/use-cases/create-inventory-item-image-upload-url.use-case';
import { GetInventoryItemImageUseCase } from '../inventory-item-images/application/use-cases/get-inventory-item-image.use-case';
import { RemoveInventoryItemImageUseCase } from '../inventory-item-images/application/use-cases/remove-inventory-item-image.use-case';
import { InventoryItemImageStatus } from '../inventory-item-images/domain/enums/inventory-item-image-status.enum';
import { InventoryItemImageEntity } from '../inventory-item-images/infrastructure/persistence/inventory-item-image.entity';
import {
  MobileImageConfirmDto,
  MobileImageUploadDto,
} from './dto/mobile-items.dto';
import { MobileItemsService } from './mobile-items.service';

/**
 * Photos of mobile items, addressed by external id. Delegates to the shared
 * presigned-upload use cases (MIME, size, quota, HEAD + SHA-256 + magic bytes,
 * tenant/project/item cross-checks); adds idempotent confirm/remove and the
 * resulting item version for the app's conflict control.
 */
@Injectable()
export class MobileImagesService {
  constructor(
    private readonly db: DataSource,
    private readonly items: MobileItemsService,
    private readonly uploadUrl: CreateInventoryItemImageUploadUrlUseCase,
    private readonly confirmUpload: ConfirmInventoryItemImageUploadUseCase,
    private readonly getImage: GetInventoryItemImageUseCase,
    private readonly downloadUrl: CreateInventoryItemImageDownloadUrlUseCase,
    private readonly removeImage: RemoveInventoryItemImageUseCase,
  ) {}

  async requestUpload(
    actor: AuthenticatedUser,
    projectId: number,
    externalId: string,
    dto: MobileImageUploadDto,
  ) {
    const { item } = await this.items.resolveItem(
      actor,
      projectId,
      externalId,
      true,
    );
    const result = await this.uploadUrl.execute(
      projectId,
      item.id,
      dto,
      this.ctx(actor),
    );
    return {
      image: result.image,
      upload_url: result.upload_url,
      upload_headers: {
        'Content-Type': dto.mime_type,
        'Content-Length': String(dto.size_bytes),
      },
      expires_in_seconds: result.expires_in_seconds,
    };
  }

  async confirm(
    actor: AuthenticatedUser,
    projectId: number,
    externalId: string,
    imageId: number,
    dto: MobileImageConfirmDto,
  ) {
    const { item } = await this.items.resolveItem(
      actor,
      projectId,
      externalId,
      true,
    );
    const current = await this.getImage.findAndAuthorize(
      imageId,
      this.ctx(actor),
      {
        projectId,
        itemId: item.id,
      },
    );
    const already = current.status === InventoryItemImageStatus.UPLOADED;
    const image = already
      ? InventoryItemImageResponseDto.fromDomain(current)
      : await this.confirmUpload.execute(
          projectId,
          item.id,
          imageId,
          dto,
          this.ctx(actor),
        );
    return {
      result: already ? ('already_confirmed' as const) : ('confirmed' as const),
      image,
      item_version: await this.items.currentVersion(item.id),
    };
  }

  async list(
    actor: AuthenticatedUser,
    projectId: number,
    externalId: string,
    withUrls: boolean,
  ) {
    const { item } = await this.items.resolveItem(
      actor,
      projectId,
      externalId,
      false,
    );
    const images = await this.db.getRepository(InventoryItemImageEntity).find({
      where: {
        inventoryItemId: item.id,
        status: Not(InventoryItemImageStatus.REMOVED),
      },
      order: { id: 'ASC' },
    });
    return {
      item_version: item.syncSeq,
      items: await Promise.all(
        images.map(async (image) => {
          const view = this.items.imageView(image);
          if (!withUrls || image.status !== InventoryItemImageStatus.UPLOADED)
            return { ...view, download_url: null, expires_in_seconds: null };
          const signed = await this.downloadUrl.execute(
            Number(image.id),
            this.ctx(actor),
            {
              projectId,
              itemId: item.id,
            },
          );
          return {
            ...view,
            download_url: signed.download_url,
            expires_in_seconds: signed.expires_in_seconds,
          };
        }),
      ),
    };
  }

  async remove(
    actor: AuthenticatedUser,
    projectId: number,
    externalId: string,
    imageId: number,
  ) {
    const { item } = await this.items.resolveItem(
      actor,
      projectId,
      externalId,
      true,
    );
    const current = await this.getImage.findAndAuthorize(
      imageId,
      this.ctx(actor),
      {
        projectId,
        itemId: item.id,
      },
    );
    if (current.status !== InventoryItemImageStatus.REMOVED)
      await this.removeImage.execute(
        projectId,
        item.id,
        imageId,
        this.ctx(actor),
      );
    return {
      result:
        current.status === InventoryItemImageStatus.REMOVED
          ? ('already_removed' as const)
          : ('removed' as const),
      item_version: await this.items.currentVersion(item.id),
    };
  }

  private ctx(actor: AuthenticatedUser) {
    return {
      id: actor.id,
      systemRoles: actor.systemRoles,
      organizationId: actor.organizationId,
    };
  }
}
