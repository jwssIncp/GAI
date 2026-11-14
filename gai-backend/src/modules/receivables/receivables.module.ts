import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { ExportJobsModule } from '../export-jobs/export-jobs.module';
import { ReceivableController } from './receivable.controller';
import { ReceivableService } from './receivable.service';
import { CashFlowService } from './cash-flow.service';
import { FinanceExportService } from './finance-export.service';
import { AssetTagsModule } from '../asset-tags/asset-tags.module';
import { CommissionsModule } from '../commissions/commissions.module';
import { FinanceSettingsModule } from '../finance-settings/finance-settings.module';
import { CashFlowBoardService } from './cash-flow-board.service';
import { CashFlowBoardController } from './cash-flow-board.controller';
@Module({
  imports: [
    AuthModule,
    ProjectsModule,
    ExportJobsModule,
    FinanceSettingsModule,
    AssetTagsModule,
    CommissionsModule,
  ],
  controllers: [ReceivableController, CashFlowBoardController],
  providers: [
    ReceivableService,
    CashFlowService,
    FinanceExportService,
    CashFlowBoardService,
  ],
  exports: [FinanceExportService],
})
export class ReceivablesModule {}
