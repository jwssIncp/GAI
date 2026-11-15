import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { ReceivablesModule } from '../receivables/receivables.module';
import { ExportJobsModule } from '../export-jobs/export-jobs.module';
import { DreController } from './dre.controller';
import { DreService } from './dre.service';
import { DreExportService } from './dre-export.service';
import { DreMonthlyController } from './dre-monthly.controller';
import {
  DreDefaultModelService,
  DreMonthlyCommandsService,
  DreMonthlyViewService,
} from './dre-monthly-commands.service';
@Module({
  imports: [AuthModule, ProjectsModule, ReceivablesModule, ExportJobsModule],
  controllers: [DreController, DreMonthlyController],
  providers: [
    DreService,
    DreExportService,
    DreMonthlyCommandsService,
    DreMonthlyViewService,
    DreDefaultModelService,
  ],
})
export class ManagerialDreModule {}
