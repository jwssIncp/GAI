import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from '../../../projects/domain/ports/project.repository.port';
import { InventoryItem } from '../../domain/entities/inventory-item';
import { InventoryItemAuditOperation } from '../../domain/enums/inventory-item-audit-operation.enum';
import {
  INVENTORY_ITEM_REPOSITORY,
  type InventoryItemRepository,
} from '../../domain/ports/inventory-item.repository.port';
import { InventoryItemResponseDto } from '../dto/inventory-item-response.dto';
import {
  InventoryItemActorContext,
  InventoryItemScopeService,
} from '../services/inventory-item-scope.service';

export type InventoryItemStatusAction = 'deactivate' | 'reactivate';

@Injectable()
export class UpdateInventoryItemStatusUseCase {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY)
    private readonly repository: InventoryItemRepository,
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepository,
    private readonly scope: InventoryItemScopeService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UpdateInventoryItemStatusUseCase.name);
  }

  async execute(
    projectId: number,
    id: number,
    action: InventoryItemStatusAction,
    actor: InventoryItemActorContext,
  ): Promise<InventoryItemResponseDto> {
    const item = await this.repository.findById(id);
    if (!item || item.projectId !== projectId) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Inventory item not found',
      });
    }
    this.scope.assertCanAccessOrganization(actor, item.organizationId);

    const project = await this.projects.findById(projectId);
    if (!project) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Project not found',
      });
    }
    this.scope.assertProjectAllowsMutation(project);

    let changes: Record<string, { before: unknown; after: unknown }>;
    try {
      changes = this.applyAction(item, action, actor.id);
    } catch (error) {
      throw new ConflictException({
        code: 'CONFLICT',
        message:
          error instanceof Error
            ? error.message
            : 'Inventory item status blocks this operation',
      });
    }

    const saved = await this.repository.saveWithAudit(item, {
      inventoryItemId: item.id,
      organizationId: item.organizationId,
      projectId: item.projectId,
      operation: this.operationFor(action),
      performedBy: actor.id,
      changes,
    });

    this.logger.info({
      operation: `INVENTORY_ITEM_${this.operationFor(action)}`,
      inventoryItemId: saved.id,
      projectId: saved.projectId,
      organizationId: saved.organizationId,
      result: 'SUCCESS',
    });

    return InventoryItemResponseDto.fromDomain(saved);
  }

  private applyAction(
    item: InventoryItem,
    action: InventoryItemStatusAction,
    actorId: number,
  ): Record<string, { before: unknown; after: unknown }> {
    if (action === 'deactivate') {
      return item.deactivate(actorId, new Date());
    }
    return item.reactivate(actorId);
  }

  private operationFor(
    action: InventoryItemStatusAction,
  ): InventoryItemAuditOperation {
    return action === 'deactivate'
      ? InventoryItemAuditOperation.DEACTIVATE
      : InventoryItemAuditOperation.REACTIVATE;
  }
}
