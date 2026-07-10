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
import { InventoryItem } from '../../domain/entities/inventory-item';
import { InventoryItemAuditOperation } from '../../domain/enums/inventory-item-audit-operation.enum';
import { InventoryItemStatus } from '../../domain/enums/inventory-item-status.enum';
import {
  INVENTORY_ITEM_REPOSITORY,
  type InventoryItemRepository,
} from '../../domain/ports/inventory-item.repository.port';
import { CreateInventoryItemDto } from '../dto/inventory-item-inputs';
import { InventoryItemResponseDto } from '../dto/inventory-item-response.dto';
import {
  InventoryItemActorContext,
  InventoryItemScopeService,
} from '../services/inventory-item-scope.service';

@Injectable()
export class CreateInventoryItemUseCase {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY)
    private readonly repository: InventoryItemRepository,
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepository,
    private readonly scope: InventoryItemScopeService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CreateInventoryItemUseCase.name);
  }

  async execute(
    projectId: number,
    dto: CreateInventoryItemDto,
    actor: InventoryItemActorContext,
  ): Promise<InventoryItemResponseDto> {
    const project = await this.projects.findById(projectId);
    if (!project) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Project not found',
      });
    }
    this.scope.assertCanAccessOrganization(actor, project.organizationId);
    this.scope.assertProjectAllowsMutation(project);

    const now = new Date();
    let item: InventoryItem;
    try {
      item = new InventoryItem({
        id: 0,
        organizationId: project.organizationId,
        projectId,
        externalItemId: this.scope.cleanText(dto.external_item_id) ?? null,
        sequence: this.scope.cleanText(dto.sequence) ?? null,
        oldPlate: this.scope.normalizePlate(dto.old_plate) ?? null,
        newPlate: this.scope.normalizePlate(dto.new_plate) ?? null,
        unitText: this.scope.cleanText(dto.unit_text) ?? null,
        addressText: this.scope.cleanText(dto.address_text) ?? null,
        locationText: this.scope.cleanText(dto.location_text) ?? null,
        description: this.scope.cleanText(dto.description) ?? null,
        brand: this.scope.cleanText(dto.brand) ?? null,
        model: this.scope.cleanText(dto.model) ?? null,
        serialNumber: this.scope.cleanText(dto.serial_number) ?? null,
        capacity: this.scope.cleanText(dto.capacity) ?? null,
        year: dto.year ?? null,
        notes: this.scope.cleanText(dto.notes) ?? null,
        source: this.scope.cleanText(dto.source) ?? 'manual',
        usedValue: dto.used_value ?? null,
        newValue: dto.new_value ?? null,
        status: dto.status ?? InventoryItemStatus.PENDING,
        metadata: dto.metadata ?? null,
        createdById: actor.id,
        updatedById: actor.id,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
    } catch (error) {
      throw this.validation(error);
    }

    const saved = await this.repository.saveWithAudit(item, {
      inventoryItemId: 0,
      organizationId: item.organizationId,
      projectId: item.projectId,
      operation: InventoryItemAuditOperation.CREATE,
      performedBy: actor.id,
      changes: {
        project_id: { before: null, after: item.projectId },
        organization_id: { before: null, after: item.organizationId },
        status: { before: null, after: item.status },
      },
    });

    this.logger.info({
      operation: 'CREATE_INVENTORY_ITEM',
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
