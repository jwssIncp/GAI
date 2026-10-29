import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { ContractController } from './contract.controller';
import { ContractService } from './contract.service';
@Module({
  imports: [AuthModule, ProjectsModule],
  controllers: [ContractController],
  providers: [ContractService],
})
export class ContractsModule {}
