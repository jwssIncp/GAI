import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { BudgetController } from './budget.controller';
import { BudgetService } from './budget.service';
import { DocumentTemplatesModule } from '../documents/document-templates.module';
@Module({
  imports: [AuthModule, ProjectsModule, DocumentTemplatesModule],
  controllers: [BudgetController],
  providers: [BudgetService],
  exports: [BudgetService],
})
export class BudgetsModule {}
