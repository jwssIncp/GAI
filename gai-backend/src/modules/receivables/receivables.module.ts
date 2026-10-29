import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { ExportJobsModule } from '../export-jobs/export-jobs.module';
import { ReceivableController } from './receivable.controller';
import { ReceivableService } from './receivable.service';
import { CashFlowService } from './cash-flow.service';
import { FinanceExportService } from './finance-export.service';
@Module({
  imports: [AuthModule, ProjectsModule, ExportJobsModule],
  controllers: [ReceivableController],
  providers: [ReceivableService, CashFlowService, FinanceExportService],
  exports: [FinanceExportService],
})
export class ReceivablesModule {}
