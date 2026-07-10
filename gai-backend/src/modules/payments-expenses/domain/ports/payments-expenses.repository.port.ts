import { ExpenseAttachment } from '../entities/expense-attachment';
import { Expense } from '../entities/expense';
import { FieldAgentPayment } from '../entities/field-agent-payment';
import { ExpenseStatus } from '../enums/expense-status.enum';
import { PaymentExpenseAuditOperation } from '../enums/payment-expense-audit-operation.enum';
import { PaymentStatus } from '../enums/payment-status.enum';

export interface ListPaymentsParams {
  page: number;
  pageSize: number;
  organizationId: number;
  projectId: number;
  fieldAgentId?: number;
  status?: PaymentStatus;
  state?: string;
  startDate?: string;
  endDateExclusive?: string;
  paymentDate?: string;
  paymentDateExclusive?: string;
  search?: string;
}
export interface ListExpensesParams {
  page: number;
  pageSize: number;
  organizationId: number;
  projectId: number;
  fieldAgentId?: number;
  status?: ExpenseStatus;
  startDate?: string;
  endDateExclusive?: string;
  search?: string;
}
export interface PaymentExpenseAuditEntry {
  organizationId: number;
  projectId: number;
  paymentId?: number | null;
  expenseId?: number | null;
  expenseAttachmentId?: number | null;
  operation: PaymentExpenseAuditOperation;
  performedBy: number | null;
  changes: Record<string, { before: unknown; after: unknown }>;
}
export const PAYMENTS_EXPENSES_REPOSITORY = Symbol(
  'PAYMENTS_EXPENSES_REPOSITORY',
);
export interface PaymentsExpensesRepository {
  findPaymentById(id: number): Promise<FieldAgentPayment | null>;
  listPayments(
    params: ListPaymentsParams,
  ): Promise<{ items: FieldAgentPayment[]; total: number }>;
  savePaymentWithAudit(
    payment: FieldAgentPayment,
    audit: PaymentExpenseAuditEntry,
  ): Promise<FieldAgentPayment>;
  findExpenseById(id: number): Promise<Expense | null>;
  listExpenses(
    params: ListExpensesParams,
  ): Promise<{ items: Expense[]; total: number }>;
  saveExpenseWithAudit(
    expense: Expense,
    audit: PaymentExpenseAuditEntry,
  ): Promise<Expense>;
  findAttachmentById(id: number): Promise<ExpenseAttachment | null>;
  listAttachments(expenseId: number): Promise<ExpenseAttachment[]>;
  saveAttachmentWithAudit(
    attachment: ExpenseAttachment,
    audit: PaymentExpenseAuditEntry,
  ): Promise<ExpenseAttachment>;
  audit(audit: PaymentExpenseAuditEntry): Promise<void>;
}
