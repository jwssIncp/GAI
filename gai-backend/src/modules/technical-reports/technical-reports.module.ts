import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { TechnicalReportsController } from './report.controller';
import { TechnicalReportsService } from './report.service';
import { ReportSourcesService } from './report.sources';
import { DocumentTemplatesModule } from '../documents/document-templates.module';
@Module({
  imports: [AuthModule, ProjectsModule, DocumentTemplatesModule],
  controllers: [TechnicalReportsController],
  providers: [TechnicalReportsService, ReportSourcesService],
  exports: [TechnicalReportsService],
})
export class TechnicalReportsModule {}
