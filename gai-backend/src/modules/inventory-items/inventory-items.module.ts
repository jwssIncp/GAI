import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { InventoryItemScopeService } from './application/services/inventory-item-scope.service';
import { CreateInventoryItemUseCase } from './application/use-cases/create-inventory-item.use-case';
import { GetInventoryItemUseCase } from './application/use-cases/get-inventory-item.use-case';
import { ListInventoryItemsUseCase } from './application/use-cases/list-inventory-items.use-case';
import { UpdateInventoryItemStatusUseCase } from './application/use-cases/update-inventory-item-status.use-case';
import { UpdateInventoryItemUseCase } from './application/use-cases/update-inventory-item.use-case';
import { INVENTORY_ITEM_REPOSITORY } from './domain/ports/inventory-item.repository.port';
import { InventoryItemAuditLogEntity } from './infrastructure/persistence/inventory-item-audit-log.entity';
import { InventoryItemEntity } from './infrastructure/persistence/inventory-item.entity';
import { TypeOrmInventoryItemRepository } from './infrastructure/persistence/typeorm-inventory-item.repository';
import { InventoryItemsController } from './presentation/inventory-items.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryItemEntity,
      InventoryItemAuditLogEntity,
    ]),
    AuthModule,
    ProjectsModule,
  ],
  controllers: [InventoryItemsController],
  providers: [
    InventoryItemScopeService,
    CreateInventoryItemUseCase,
    ListInventoryItemsUseCase,
    GetInventoryItemUseCase,
    UpdateInventoryItemUseCase,
    UpdateInventoryItemStatusUseCase,
    {
      provide: INVENTORY_ITEM_REPOSITORY,
      useClass: TypeOrmInventoryItemRepository,
    },
  ],
  exports: [INVENTORY_ITEM_REPOSITORY, TypeOrmModule],
})
export class InventoryItemsModule {}
