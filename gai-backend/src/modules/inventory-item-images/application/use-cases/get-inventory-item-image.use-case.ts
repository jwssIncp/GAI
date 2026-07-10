import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  INVENTORY_ITEM_REPOSITORY,
  type InventoryItemRepository,
} from '../../../inventory-items/domain/ports/inventory-item.repository.port';
import {
  INVENTORY_ITEM_IMAGE_REPOSITORY,
  type InventoryItemImageRepository,
} from '../../domain/ports/inventory-item-image.repository.port';
import { InventoryItemImageResponseDto } from '../dto/inventory-item-image-response.dto';
import {
  InventoryItemImageActorContext,
  InventoryItemImageScopeService,
} from '../services/inventory-item-image-scope.service';

@Injectable()
export class GetInventoryItemImageUseCase {
  constructor(
    @Inject(INVENTORY_ITEM_IMAGE_REPOSITORY)
    private readonly repository: InventoryItemImageRepository,
    @Inject(INVENTORY_ITEM_REPOSITORY)
    private readonly inventoryItems: InventoryItemRepository,
    private readonly scope: InventoryItemImageScopeService,
  ) {}

  async execute(
    imageId: number,
    actor: InventoryItemImageActorContext,
    expected?: { projectId?: number; itemId?: number },
  ): Promise<InventoryItemImageResponseDto> {
    const image = await this.findAndAuthorize(imageId, actor, expected);
    return InventoryItemImageResponseDto.fromDomain(image);
  }

  async findAndAuthorize(
    imageId: number,
    actor: InventoryItemImageActorContext,
    expected?: { projectId?: number; itemId?: number },
  ) {
    const image = await this.repository.findById(imageId);
    if (!image) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Inventory item image not found',
      });
    }
    if (
      expected?.itemId !== undefined &&
      image.inventoryItemId !== expected.itemId
    ) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Inventory item image not found',
      });
    }

    const item = await this.inventoryItems.findById(image.inventoryItemId);
    if (!item) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Inventory item not found',
      });
    }
    if (expected?.projectId !== undefined) {
      this.scope.assertItemBelongsToProject(item, expected.projectId);
    }
    this.scope.assertCanAccessOrganization(actor, image.organizationId);
    return image;
  }
}
