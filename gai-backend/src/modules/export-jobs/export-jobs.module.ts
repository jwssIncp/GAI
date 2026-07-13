import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { ExportJobProcessorService } from './application/services/export-job-processor.service';
import { ExportJobsService } from './application/services/export-jobs.service';
import { ExportWorkbookBuilderService } from './application/services/export-workbook-builder.service';
import { ExportJobAuditLogEntity } from './infrastructure/persistence/export-job-audit-log.entity';
import { ExportJobEntity } from './infrastructure/persistence/export-job.entity';
import { ExportJobsController } from './presentation/export-jobs.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExportJobEntity, ExportJobAuditLogEntity]),
    AuthModule,
    ProjectsModule,
  ],
  controllers: [ExportJobsController],
  providers: [
    ExportWorkbookBuilderService,
    ExportJobProcessorService,
    ExportJobsService,
  ],
  exports: [TypeOrmModule],
})
export class ExportJobsModule {}
