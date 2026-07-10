import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfiguredStorageSignerService } from '../../common/storage/configured-storage-signer.service';
import { STORAGE_SIGNER } from '../../common/storage/storage-signer.port';
import { AuthModule } from '../auth/auth.module';
import { FieldAgentsModule } from '../field-agents/field-agents.module';
import { ProjectsModule } from '../projects/projects.module';
import { PaymentsExpensesScopeService } from './application/services/payments-expenses-scope.service';
import { PaymentsExpensesService } from './application/services/payments-expenses.service';
import { PAYMENTS_EXPENSES_REPOSITORY } from './domain/ports/payments-expenses.repository.port';
import { ExpenseAttachmentEntity } from './infrastructure/persistence/expense-attachment.entity';
import { ExpenseEntity } from './infrastructure/persistence/expense.entity';
import { FieldAgentPaymentEntity } from './infrastructure/persistence/field-agent-payment.entity';
import { PaymentExpenseAuditLogEntity } from './infrastructure/persistence/payment-expense-audit-log.entity';
import { TypeOrmPaymentsExpensesRepository } from './infrastructure/persistence/typeorm-payments-expenses.repository';
import { PaymentsExpensesController } from './presentation/payments-expenses.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FieldAgentPaymentEntity,
      ExpenseEntity,
      ExpenseAttachmentEntity,
      PaymentExpenseAuditLogEntity,
    ]),
    AuthModule,
    ProjectsModule,
    FieldAgentsModule,
  ],
  controllers: [PaymentsExpensesController],
  providers: [
    PaymentsExpensesScopeService,
    PaymentsExpensesService,
    {
      provide: PAYMENTS_EXPENSES_REPOSITORY,
      useClass: TypeOrmPaymentsExpensesRepository,
    },
    { provide: STORAGE_SIGNER, useClass: ConfiguredStorageSignerService },
  ],
  exports: [PAYMENTS_EXPENSES_REPOSITORY, TypeOrmModule],
})
export class PaymentsExpensesModule {}
