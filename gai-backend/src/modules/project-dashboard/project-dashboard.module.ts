import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ProjectFieldAgentEntity } from '../field-agents/infrastructure/persistence/project-field-agent.entity';
import { ImportSessionEntity } from '../import-sessions/infrastructure/persistence/import-session.entity';
import { InventoryAccountingItemEntity } from '../inventory-accounting-items/infrastructure/persistence/inventory-accounting-item.entity';
import { InventoryItemImageEntity } from '../inventory-item-images/infrastructure/persistence/inventory-item-image.entity';
import { InventoryItemEntity } from '../inventory-items/infrastructure/persistence/inventory-item.entity';
import { InventoryPendingIssueEntity } from '../inventory-pending-issues/infrastructure/persistence/inventory-pending-issue.entity';
import { ExpenseEntity } from '../payments-expenses/infrastructure/persistence/expense.entity';
import { FieldAgentPaymentEntity } from '../payments-expenses/infrastructure/persistence/field-agent-payment.entity';
import { ProjectsModule } from '../projects/projects.module';
import { ProjectSummaryService } from './application/services/project-summary.service';
import { PROJECT_SUMMARY_REPOSITORY } from './domain/ports/project-summary.repository.port';
import { TypeOrmProjectSummaryRepository } from './infrastructure/persistence/typeorm-project-summary.repository';
import { ProjectDashboardController } from './presentation/project-dashboard.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryItemEntity,
      InventoryItemImageEntity,
      InventoryAccountingItemEntity,
      InventoryPendingIssueEntity,
      ProjectFieldAgentEntity,
      FieldAgentPaymentEntity,
      ExpenseEntity,
      ImportSessionEntity,
    ]),
    AuthModule,
    ProjectsModule,
  ],
  controllers: [ProjectDashboardController],
  providers: [
    ProjectSummaryService,
    {
      provide: PROJECT_SUMMARY_REPOSITORY,
      useClass: TypeOrmProjectSummaryRepository,
    },
  ],
})
export class ProjectDashboardModule {}
