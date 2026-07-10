import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  INVENTORY_ITEM_REPOSITORY,
  type InventoryItemRepository,
} from '../../domain/ports/inventory-item.repository.port';
import { InventoryItemResponseDto } from '../dto/inventory-item-response.dto';
import {
  InventoryItemActorContext,
  InventoryItemScopeService,
} from '../services/inventory-item-scope.service';

@Injectable()
export class GetInventoryItemUseCase {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY)
    private readonly repository: InventoryItemRepository,
    private readonly scope: InventoryItemScopeService,
  ) {}

  async execute(
    id: number,
    actor: InventoryItemActorContext,
    projectId?: number,
  ): Promise<InventoryItemResponseDto> {
    const item = await this.repository.findById(id);
    if (!item || (projectId !== undefined && item.projectId !== projectId)) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Inventory item not found',
      });
    }
    this.scope.assertCanAccessOrganization(actor, item.organizationId);
    return InventoryItemResponseDto.fromDomain(item);
  }
}
