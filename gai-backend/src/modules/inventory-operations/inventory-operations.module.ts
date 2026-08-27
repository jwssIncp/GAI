import { Module } from '@nestjs/common';
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
  ],
  controllers: [InventoryOperationsController],
  providers: [
    InventoryOperationsService,
    InventoryItemImageScopeService,
    { provide: STORAGE_SIGNER, useClass: ConfiguredStorageSignerService },
  ],
  exports: [TypeOrmModule],
})
export class InventoryOperationsModule {}
