import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { FinanceSettingsController } from './finance-settings.controller';
import { FinanceSettingsService } from './finance-settings.service';

@Module({
  imports: [AuthModule, ProjectsModule],
  controllers: [FinanceSettingsController],
  providers: [FinanceSettingsService],
  exports: [FinanceSettingsService],
})
export class FinanceSettingsModule {}
