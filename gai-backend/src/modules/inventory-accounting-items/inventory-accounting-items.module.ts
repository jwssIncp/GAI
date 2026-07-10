import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { AccountingImportParserService } from './application/services/accounting-import-parser.service';
import { InventoryAccountingItemScopeService } from './application/services/inventory-accounting-item-scope.service';
import { InventoryAccountingItemsService } from './application/services/inventory-accounting-items.service';
import { INVENTORY_ACCOUNTING_ITEM_REPOSITORY } from './domain/ports/inventory-accounting-item.repository.port';
import { AccountingImportBatchEntity } from './infrastructure/persistence/accounting-import-batch.entity';
import { InventoryAccountingItemAuditLogEntity } from './infrastructure/persistence/inventory-accounting-item-audit-log.entity';
import { InventoryAccountingItemEntity } from './infrastructure/persistence/inventory-accounting-item.entity';
import { TypeOrmInventoryAccountingItemRepository } from './infrastructure/persistence/typeorm-inventory-accounting-item.repository';
import { InventoryAccountingItemsController } from './presentation/inventory-accounting-items.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryAccountingItemEntity,
      InventoryAccountingItemAuditLogEntity,
      AccountingImportBatchEntity,
    ]),
    AuthModule,
    ProjectsModule,
  ],
  controllers: [InventoryAccountingItemsController],
  providers: [
    InventoryAccountingItemScopeService,
    AccountingImportParserService,
    InventoryAccountingItemsService,
    {
      provide: INVENTORY_ACCOUNTING_ITEM_REPOSITORY,
      useClass: TypeOrmInventoryAccountingItemRepository,
    },
  ],
  exports: [INVENTORY_ACCOUNTING_ITEM_REPOSITORY, TypeOrmModule],
})
export class InventoryAccountingItemsModule {}
