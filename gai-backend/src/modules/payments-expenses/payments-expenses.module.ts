import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfiguredStorageSignerService } from '../../common/storage/configured-storage-signer.service';
import { STORAGE_SIGNER } from '../../common/storage/storage-signer.port';
import { AuthModule } from '../auth/auth.module';
import { FinanceSettingsModule } from '../finance-settings/finance-settings.module';
import { RemunerationService } from './application/services/remuneration.service';
import { RemunerationController } from './presentation/remuneration.controller';
import { FieldAgentPaymentsController } from './presentation/field-agent-payments.controller';
import { FieldAgentPaymentsService } from './application/services/field-agent-payments.service';
import { FieldAgentsModule } from '../field-agents/field-agents.module';
import { ProjectsModule } from '../projects/projects.module';
import { PaymentsExpensesScopeService } from './application/services/payments-expenses-scope.service';
import { PaymentsExpensesService } from './application/services/payments-expenses.service';
import { PAYMENTS_EXPENSES_REPOSITORY } from './domain/ports/payments-expenses.repository.port';
import { ExpenseAttachmentEntity } from './infrastructure/persistence/expense-attachment.entity';
import { ExpenseEntity } from './infrastructure/persistence/expense.entity';
import {
  ExpenseAdvanceEntity,
  ExpenseReimbursementBatchEntity,
  ProjectFinancialClosureEntity,
} from './infrastructure/persistence/expense-parity.entities';
import { ExpenseRulesService } from './application/services/expense-rules.service';
import { ProjectExpensesService } from './application/services/project-expenses.service';
import { ExpenseTransferService } from './application/services/expense-transfer.service';
import { ProjectExpensesController } from './presentation/project-expenses.controller';
import { FieldAgentPaymentEntity } from './infrastructure/persistence/field-agent-payment.entity';
import { PaymentExpenseAuditLogEntity } from './infrastructure/persistence/payment-expense-audit-log.entity';
import { TypeOrmPaymentsExpensesRepository } from './infrastructure/persistence/typeorm-payments-expenses.repository';
import { PaymentsExpensesController } from './presentation/payments-expenses.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FieldAgentPaymentEntity,
      ExpenseEntity,
      ExpenseAdvanceEntity,
      ExpenseReimbursementBatchEntity,
      ProjectFinancialClosureEntity,
      ExpenseAttachmentEntity,
      PaymentExpenseAuditLogEntity,
    ]),
    AuthModule,
    ProjectsModule,
    FieldAgentsModule,
    FinanceSettingsModule,
  ],
  controllers: [
    PaymentsExpensesController,
    RemunerationController,
    FieldAgentPaymentsController,
    ProjectExpensesController,
  ],
  providers: [
    RemunerationService,
    FieldAgentPaymentsService,
    PaymentsExpensesScopeService,
    PaymentsExpensesService,
    ExpenseRulesService,
    ProjectExpensesService,
    ExpenseTransferService,
    {
      provide: PAYMENTS_EXPENSES_REPOSITORY,
      useClass: TypeOrmPaymentsExpensesRepository,
    },
    { provide: STORAGE_SIGNER, useClass: ConfiguredStorageSignerService },
  ],
  exports: [
    PAYMENTS_EXPENSES_REPOSITORY,
    PaymentsExpensesService,
    TypeOrmModule,
  ],
})
export class PaymentsExpensesModule {}
