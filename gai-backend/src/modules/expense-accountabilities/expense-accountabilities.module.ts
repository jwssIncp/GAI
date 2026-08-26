import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ProjectFieldAgentEntity } from '../field-agents/infrastructure/persistence/project-field-agent.entity';
import { ExpenseEntity } from '../payments-expenses/infrastructure/persistence/expense.entity';
import { ProjectEntity } from '../projects/infrastructure/persistence/project.entity';
import { ExpenseAccountabilitiesController } from './expense-accountabilities.controller';
import { ExpenseAccountabilitiesService } from './expense-accountabilities.service';
import {
  ExpenseAccountabilityAuditLogEntity,
  ExpenseAccountabilityEntity,
  ExpenseAccountabilityItemEntity,
  ExpenseInstallmentEntity,
} from './expense-accountability.entity';
export const EXPENSE_ACCOUNTABILITY_ENTITIES = [
  ExpenseAccountabilityEntity,
  ExpenseAccountabilityItemEntity,
  ExpenseInstallmentEntity,
  ExpenseAccountabilityAuditLogEntity,
];
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ...EXPENSE_ACCOUNTABILITY_ENTITIES,
      ProjectEntity,
      ProjectFieldAgentEntity,
      ExpenseEntity,
    ]),
    AuthModule,
  ],
  controllers: [ExpenseAccountabilitiesController],
  providers: [ExpenseAccountabilitiesService],
})
export class ExpenseAccountabilitiesModule {}
