import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { InventoryAccountingItemsModule } from '../inventory-accounting-items/inventory-accounting-items.module';
import { InventoryItemsModule } from '../inventory-items/inventory-items.module';
import { ProjectsModule } from '../projects/projects.module';
import { InventoryPendingIssueScopeService } from './application/services/inventory-pending-issue-scope.service';
import { InventoryPendingIssuesService } from './application/services/inventory-pending-issues.service';
import { INVENTORY_PENDING_ISSUE_REPOSITORY } from './domain/ports/inventory-pending-issue.repository.port';
import { InventoryPendingIssueAuditLogEntity } from './infrastructure/persistence/inventory-pending-issue-audit-log.entity';
import { InventoryPendingIssueEntity } from './infrastructure/persistence/inventory-pending-issue.entity';
import { TypeOrmInventoryPendingIssueRepository } from './infrastructure/persistence/typeorm-inventory-pending-issue.repository';
import { InventoryPendingIssuesController } from './presentation/inventory-pending-issues.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryPendingIssueEntity,
      InventoryPendingIssueAuditLogEntity,
    ]),
    AuthModule,
    ProjectsModule,
    InventoryItemsModule,
    InventoryAccountingItemsModule,
  ],
  controllers: [InventoryPendingIssuesController],
  providers: [
    InventoryPendingIssueScopeService,
    InventoryPendingIssuesService,
    {
      provide: INVENTORY_PENDING_ISSUE_REPOSITORY,
      useClass: TypeOrmInventoryPendingIssueRepository,
    },
  ],
  exports: [INVENTORY_PENDING_ISSUE_REPOSITORY, TypeOrmModule],
})
export class InventoryPendingIssuesModule {}
