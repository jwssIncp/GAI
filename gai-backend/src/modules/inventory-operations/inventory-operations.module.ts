import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import {
  ValuationBatch,
  ValuationBatchRow,
} from './infrastructure/persistence/valuation-batch.entity';
import { ValuationBatchService } from './application/valuation-batch.service';
import { ValuationBatchController } from './presentation/valuation-batch.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfiguredStorageSignerService } from '../../common/storage/configured-storage-signer.service';
import { STORAGE_SIGNER } from '../../common/storage/storage-signer.port';
import { AuthModule } from '../auth/auth.module';
import { ProjectFieldAgentEntity } from '../field-agents/infrastructure/persistence/project-field-agent.entity';
import { InventoryAccountingItemEntity } from '../inventory-accounting-items/infrastructure/persistence/inventory-accounting-item.entity';
import { InventoryItemEntity } from '../inventory-items/infrastructure/persistence/inventory-item.entity';
import { InventoryItemImageScopeService } from '../inventory-item-images/application/services/inventory-item-image-scope.service';
import { ProjectEntity } from '../projects/infrastructure/persistence/project.entity';
import { InventoryOperationsService } from './application/inventory-operations.service';
import {
  AssetValuationEntity,
  InventoryConsolidationEntity,
  InventoryObservationEntity,
  InventoryObservationEvidenceEntity,
  InventoryOperationAuditLogEntity,
  InventoryPlateHistoryEntity,
  InventoryReconciliationEntity,
  InventoryRoundEntity,
  InventorySessionEntity,
} from './infrastructure/persistence/inventory-operation.entity';
import { InventoryOperationsController } from './presentation/inventory-operations.controller';

export const INVENTORY_OPERATION_ENTITIES = [
  ValuationBatch,
  ValuationBatchRow,
  InventorySessionEntity,
  InventoryRoundEntity,
  InventoryObservationEntity,
  InventoryObservationEvidenceEntity,
  InventoryPlateHistoryEntity,
  InventoryReconciliationEntity,
  InventoryConsolidationEntity,
  AssetValuationEntity,
  InventoryOperationAuditLogEntity,
];

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ...INVENTORY_OPERATION_ENTITIES,
      ProjectEntity,
      InventoryItemEntity,
      InventoryAccountingItemEntity,
      ProjectFieldAgentEntity,
    ]),
    AuthModule,
    ProjectsModule,
  ],
  controllers: [InventoryOperationsController, ValuationBatchController],
  providers: [
    InventoryOperationsService,
    ValuationBatchService,
    InventoryItemImageScopeService,
    { provide: STORAGE_SIGNER, useClass: ConfiguredStorageSignerService },
  ],
  exports: [TypeOrmModule, InventoryOperationsService],
})
export class InventoryOperationsModule {}
