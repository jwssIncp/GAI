import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from '../../../projects/domain/ports/project.repository.port';
import { InventoryItemAuditOperation } from '../../domain/enums/inventory-item-audit-operation.enum';
import {
  INVENTORY_ITEM_REPOSITORY,
  type InventoryItemRepository,
} from '../../domain/ports/inventory-item.repository.port';
import { UpdateInventoryItemDto } from '../dto/inventory-item-inputs';
import { InventoryItemResponseDto } from '../dto/inventory-item-response.dto';
import {
  InventoryItemActorContext,
  InventoryItemScopeService,
} from '../services/inventory-item-scope.service';

@Injectable()
export class UpdateInventoryItemUseCase {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY)
    private readonly repository: InventoryItemRepository,
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepository,
    private readonly scope: InventoryItemScopeService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UpdateInventoryItemUseCase.name);
  }

  async execute(
    projectId: number,
    id: number,
    dto: UpdateInventoryItemDto,
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
      changes = item.updateFields({
        externalItemId: this.scope.cleanText(dto.external_item_id),
        sequence: this.scope.cleanText(dto.sequence),
        oldPlate: this.scope.normalizePlate(dto.old_plate),
        newPlate: this.scope.normalizePlate(dto.new_plate),
        unitText: this.scope.cleanText(dto.unit_text),
        addressText: this.scope.cleanText(dto.address_text),
        locationText: this.scope.cleanText(dto.location_text),
        description: this.scope.cleanText(dto.description),
        brand: this.scope.cleanText(dto.brand),
        model: this.scope.cleanText(dto.model),
        serialNumber: this.scope.cleanText(dto.serial_number),
        capacity: this.scope.cleanText(dto.capacity),
        year: dto.year,
        notes: this.scope.cleanText(dto.notes),
        source: this.scope.cleanText(dto.source),
        usedValue: dto.used_value,
        newValue: dto.new_value,
        status: dto.status,
        metadata: dto.metadata,
        updatedById: actor.id,
      });
    } catch (error) {
      throw this.validation(error);
    }

    if (Object.keys(changes).length === 0) {
      return InventoryItemResponseDto.fromDomain(item);
    }

    const saved = await this.repository.saveWithAudit(item, {
      inventoryItemId: item.id,
      organizationId: item.organizationId,
      projectId: item.projectId,
      operation: InventoryItemAuditOperation.UPDATE,
      performedBy: actor.id,
      changes,
    });

    this.logger.info({
      operation: 'UPDATE_INVENTORY_ITEM',
      inventoryItemId: saved.id,
      projectId: saved.projectId,
      organizationId: saved.organizationId,
      result: 'SUCCESS',
    });

    return InventoryItemResponseDto.fromDomain(saved);
  }

  private validation(error: unknown): BadRequestException {
    return new BadRequestException({
      code: 'VALIDATION_ERROR',
      message:
        error instanceof Error ? error.message : 'Invalid inventory item',
    });
  }
}
