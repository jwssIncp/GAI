import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from '../../../projects/domain/ports/project.repository.port';
import {
  INVENTORY_ITEM_REPOSITORY,
  type InventoryItemRepository,
} from '../../domain/ports/inventory-item.repository.port';
import {
  InventoryItemListResponseDto,
  InventoryItemResponseDto,
} from '../dto/inventory-item-response.dto';
import { ListInventoryItemsQueryDto } from '../dto/list-inventory-items-query.dto';
import {
  InventoryItemActorContext,
  InventoryItemScopeService,
} from '../services/inventory-item-scope.service';

@Injectable()
export class ListInventoryItemsUseCase {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY)
    private readonly repository: InventoryItemRepository,
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepository,
    private readonly scope: InventoryItemScopeService,
  ) {}

  async execute(
    query: ListInventoryItemsQueryDto,
    actor: InventoryItemActorContext,
    forcedProjectId?: number,
  ): Promise<InventoryItemListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const projectId = forcedProjectId ?? query.project_id;
    let organizationId = this.scope.resolveOrganizationFilter(
      actor,
      query.organization_id,
    );

    if (projectId !== undefined) {
      const project = await this.projects.findById(projectId);
      if (!project) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }
      this.scope.assertCanAccessOrganization(actor, project.organizationId);
      organizationId = project.organizationId;
    }

    const { items, total } = await this.repository.list({
      page,
      pageSize,
      organizationId,
      projectId,
      status: query.status,
      oldPlate: this.scope.normalizePlate(query.old_plate) ?? undefined,
      newPlate: this.scope.normalizePlate(query.new_plate) ?? undefined,
      description: query.description,
      search: query.search,
    });

    return {
      items: items.map((item) => InventoryItemResponseDto.fromDomain(item)),
      page,
      page_size: pageSize,
      total_items: total,
      total_pages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }
}
