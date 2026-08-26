import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ProjectFieldAgentEntity } from '../field-agents/infrastructure/persistence/project-field-agent.entity';
import { ProjectUnitEntity } from '../companies/infrastructure/persistence/project-unit.entity';
import { ExportJobEntity } from '../export-jobs/infrastructure/persistence/export-job.entity';
import { ImportSessionEntity } from '../import-sessions/infrastructure/persistence/import-session.entity';
import { InventoryAccountingItemEntity } from '../inventory-accounting-items/infrastructure/persistence/inventory-accounting-item.entity';
import { InventoryItemImageEntity } from '../inventory-item-images/infrastructure/persistence/inventory-item-image.entity';
import { InventoryItemEntity } from '../inventory-items/infrastructure/persistence/inventory-item.entity';
import { InventoryItemAuditLogEntity } from '../inventory-items/infrastructure/persistence/inventory-item-audit-log.entity';
import { InventoryPendingIssueEntity } from '../inventory-pending-issues/infrastructure/persistence/inventory-pending-issue.entity';
import { ExpenseEntity } from '../payments-expenses/infrastructure/persistence/expense.entity';
import { FieldAgentPaymentEntity } from '../payments-expenses/infrastructure/persistence/field-agent-payment.entity';
import { ProjectsModule } from '../projects/projects.module';
import { ProjectSummaryService } from './application/services/project-summary.service';
import { ProjectDashboardAnalyticsService } from './application/services/project-dashboard-analytics.service';
import { PROJECT_DASHBOARD_ANALYTICS_REPOSITORY } from './domain/ports/project-dashboard-analytics.repository.port';
import { PROJECT_SUMMARY_REPOSITORY } from './domain/ports/project-summary.repository.port';
import { TypeOrmProjectSummaryRepository } from './infrastructure/persistence/typeorm-project-summary.repository';
import { TypeOrmProjectDashboardAnalyticsRepository } from './infrastructure/persistence/typeorm-project-dashboard-analytics.repository';
import { ProjectDashboardController } from './presentation/project-dashboard.controller';
import {
  InventoryConsolidationEntity,
  InventoryObservationEntity,
  InventoryReconciliationEntity,
  InventoryRoundEntity,
  InventorySessionEntity,
} from '../inventory-operations/infrastructure/persistence/inventory-operation.entity';
import { ExpenseAccountabilityEntity } from '../expense-accountabilities/expense-accountability.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryItemEntity,
      InventoryItemAuditLogEntity,
      InventoryItemImageEntity,
      InventoryAccountingItemEntity,
      InventoryPendingIssueEntity,
      ProjectFieldAgentEntity,
      ProjectUnitEntity,
      FieldAgentPaymentEntity,
      ExpenseEntity,
      ImportSessionEntity,
      ExportJobEntity,
      InventorySessionEntity,
      InventoryRoundEntity,
      InventoryObservationEntity,
      InventoryReconciliationEntity,
      InventoryConsolidationEntity,
      ExpenseAccountabilityEntity,
    ]),
    AuthModule,
    ProjectsModule,
  ],
  controllers: [ProjectDashboardController],
  providers: [
    ProjectSummaryService,
    ProjectDashboardAnalyticsService,
    {
      provide: PROJECT_DASHBOARD_ANALYTICS_REPOSITORY,
      useClass: TypeOrmProjectDashboardAnalyticsRepository,
    },
    {
      provide: PROJECT_SUMMARY_REPOSITORY,
      useClass: TypeOrmProjectSummaryRepository,
    },
  ],
})
export class ProjectDashboardModule {}
