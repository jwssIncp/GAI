import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from '../../../projects/domain/ports/project.repository.port';
import { InventoryItemImageAuditOperation } from '../../domain/enums/inventory-item-image-audit-operation.enum';
import {
  INVENTORY_ITEM_IMAGE_REPOSITORY,
  type InventoryItemImageRepository,
} from '../../domain/ports/inventory-item-image.repository.port';
import { InventoryItemImageResponseDto } from '../dto/inventory-item-image-response.dto';
import {
  InventoryItemImageActorContext,
  InventoryItemImageScopeService,
} from '../services/inventory-item-image-scope.service';
import { GetInventoryItemImageUseCase } from './get-inventory-item-image.use-case';

@Injectable()
export class RemoveInventoryItemImageUseCase {
  constructor(
    @Inject(INVENTORY_ITEM_IMAGE_REPOSITORY)
    private readonly repository: InventoryItemImageRepository,
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepository,
    private readonly getImage: GetInventoryItemImageUseCase,
    private readonly scope: InventoryItemImageScopeService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(RemoveInventoryItemImageUseCase.name);
  }

  async execute(
    projectId: number,
    itemId: number,
    imageId: number,
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

    const image = await this.getImage.findAndAuthorize(imageId, actor, {
      projectId,
      itemId,
    });
    let changes: Record<string, { before: unknown; after: unknown }>;
    try {
      changes = image.remove(actor.id, new Date());
    } catch (error) {
      throw new ConflictException({
        code: 'CONFLICT',
        message:
          error instanceof Error
            ? error.message
            : 'Inventory item image cannot be removed',
      });
    }

    const saved = await this.repository.saveWithAudit(image, {
      inventoryItemImageId: image.id,
      organizationId: image.organizationId,
      inventoryItemId: image.inventoryItemId,
      operation: InventoryItemImageAuditOperation.REMOVE,
      performedBy: actor.id,
      changes,
    });

    this.logger.info({
      operation: 'REMOVE_INVENTORY_ITEM_IMAGE',
      inventoryItemImageId: saved.id,
      inventoryItemId: saved.inventoryItemId,
      organizationId: saved.organizationId,
      result: 'SUCCESS',
    });

    return InventoryItemImageResponseDto.fromDomain(saved);
  }
}
