import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  INVENTORY_ITEM_REPOSITORY,
  type InventoryItemRepository,
} from '../../../inventory-items/domain/ports/inventory-item.repository.port';
import {
  INVENTORY_ITEM_IMAGE_REPOSITORY,
  type InventoryItemImageRepository,
} from '../../domain/ports/inventory-item-image.repository.port';
import {
  InventoryItemImageListResponseDto,
  InventoryItemImageResponseDto,
} from '../dto/inventory-item-image-response.dto';
import { ListInventoryItemImagesQueryDto } from '../dto/list-inventory-item-images-query.dto';
import {
  InventoryItemImageActorContext,
  InventoryItemImageScopeService,
} from '../services/inventory-item-image-scope.service';

@Injectable()
export class ListInventoryItemImagesUseCase {
  constructor(
    @Inject(INVENTORY_ITEM_IMAGE_REPOSITORY)
    private readonly repository: InventoryItemImageRepository,
    @Inject(INVENTORY_ITEM_REPOSITORY)
    private readonly inventoryItems: InventoryItemRepository,
    private readonly scope: InventoryItemImageScopeService,
  ) {}

  async execute(
    projectId: number,
    itemId: number,
    query: ListInventoryItemImagesQueryDto,
    actor: InventoryItemImageActorContext,
  ): Promise<InventoryItemImageListResponseDto> {
    const item = await this.inventoryItems.findById(itemId);
    if (!item) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Inventory item not found',
      });
    }
    this.scope.assertItemBelongsToProject(item, projectId);
    this.scope.assertCanAccessOrganization(actor, item.organizationId);

    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const result = await this.repository.list({
      page,
      pageSize,
      organizationId: item.organizationId,
      inventoryItemId: item.id,
      status: query.status,
    });

    return {
      items: result.items.map((image) =>
        InventoryItemImageResponseDto.fromDomain(image),
      ),
      page,
      page_size: pageSize,
      total_items: result.total,
      total_pages: Math.ceil(result.total / pageSize),
    };
  }
}
