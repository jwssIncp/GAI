import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TechnicalReportsModule } from '../technical-reports/technical-reports.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { DocumentTemplatesModule } from './document-templates.module';
import {
  BudgetDocumentsController,
  DocumentTemplatesController,
  ReportDocumentsController,
} from './documents.controller';
import { DocumentsService } from './documents.service';
@Module({
  imports: [
    AuthModule,
    TechnicalReportsModule,
    BudgetsModule,
    DocumentTemplatesModule,
  ],
  controllers: [
    ReportDocumentsController,
    BudgetDocumentsController,
    DocumentTemplatesController,
  ],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
