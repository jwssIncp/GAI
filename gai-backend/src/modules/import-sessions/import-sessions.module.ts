import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfiguredStorageSignerService } from '../../common/storage/configured-storage-signer.service';
import { STORAGE_SIGNER } from '../../common/storage/storage-signer.port';
import { AuthModule } from '../auth/auth.module';
import { InventoryItemAuditLogEntity } from '../inventory-items/infrastructure/persistence/inventory-item-audit-log.entity';
import { InventoryItemEntity } from '../inventory-items/infrastructure/persistence/inventory-item.entity';
import { ProjectsModule } from '../projects/projects.module';
import { ImportSessionScopeService } from './application/services/import-session-scope.service';
import { ImportSessionsService } from './application/services/import-sessions.service';
import { IMPORT_SESSIONS_REPOSITORY } from './domain/ports/import-sessions.repository.port';
import { ImportFileEntity } from './infrastructure/persistence/import-file.entity';
import { ImportPayloadEntity } from './infrastructure/persistence/import-payload.entity';
import { ImportPayloadErrorEntity } from './infrastructure/persistence/import-payload-error.entity';
import { ImportSessionAuditLogEntity } from './infrastructure/persistence/import-session-audit-log.entity';
import { ImportSessionEntity } from './infrastructure/persistence/import-session.entity';
import { TypeOrmImportSessionsRepository } from './infrastructure/persistence/typeorm-import-sessions.repository';
import { ImportSessionsController } from './presentation/import-sessions.controller';
import { PhysicalObservationImportParserService } from './application/services/physical-observation-import-parser.service';
import { ProjectFieldAgentEntity } from '../field-agents/infrastructure/persistence/project-field-agent.entity';
import {
  InventoryObservationEntity,
  InventoryOperationAuditLogEntity,
  InventoryPlateHistoryEntity,
  InventoryRoundEntity,
  InventorySessionEntity,
} from '../inventory-operations/infrastructure/persistence/inventory-operation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ImportSessionEntity,
      ImportPayloadEntity,
      ImportPayloadErrorEntity,
      ImportFileEntity,
      ImportSessionAuditLogEntity,
      InventoryItemEntity,
      InventoryItemAuditLogEntity,
      ProjectFieldAgentEntity,
      InventorySessionEntity,
      InventoryRoundEntity,
      InventoryObservationEntity,
      InventoryPlateHistoryEntity,
      InventoryOperationAuditLogEntity,
    ]),
    AuthModule,
    ProjectsModule,
  ],
  controllers: [ImportSessionsController],
  providers: [
    ImportSessionScopeService,
    ImportSessionsService,
    PhysicalObservationImportParserService,
    {
      provide: IMPORT_SESSIONS_REPOSITORY,
      useClass: TypeOrmImportSessionsRepository,
    },
    { provide: STORAGE_SIGNER, useClass: ConfiguredStorageSignerService },
  ],
  exports: [IMPORT_SESSIONS_REPOSITORY, TypeOrmModule],
})
export class ImportSessionsModule {}
