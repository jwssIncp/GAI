import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { FinanceSettingsModule } from '../finance-settings/finance-settings.module';
import { ContractController } from './contract.controller';
import { ContractService } from './contract.service';
@Module({
  imports: [AuthModule, ProjectsModule, FinanceSettingsModule],
  controllers: [ContractController],
  providers: [ContractService],
})
export class ContractsModule {}
