import { CIVIL_DATE_TRANSFORMER } from '../../../../common/persistence/civil-date.transformer';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  FOREIGN_KEY_COLUMN,
  PRIMARY_KEY_COLUMN,
} from '../../../../common/persistence/entity-id.columns';
import { JsonRecord } from '../../domain/entities/field-agent-payment';
import { ExpenseStatus } from '../../domain/enums/expense-status.enum';

@Entity('expenses')
@Index('idx_expenses_project_status', ['projectId', 'status'])
@Index('idx_expenses_field_agent', ['fieldAgentId'])
@Index('uq_expenses_project_sequence', ['projectId', 'projectSequence'], {
  unique: true,
})
export class ExpenseEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ name: 'field_agent_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  fieldAgentId!: number | null;
  @Column({ type: 'text' }) description!: string;
  @Column({ type: 'text', nullable: true }) reason!: string | null;
  @Column({
    name: 'expense_date',
    type: 'date',
    transformer: CIVIL_DATE_TRANSFORMER,
  })
  expenseDate!: Date;
  @Column({ type: 'decimal', precision: 15, scale: 2 }) amount!: string;
  @Column({ type: 'varchar', length: 20, default: ExpenseStatus.PENDING })
  status!: ExpenseStatus;
  @Column({ name: 'approved_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  approvedById!: number | null;
  @Column({
    name: 'approved_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  approvedAt!: Date | null;
  @Column({ name: 'rejected_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  rejectedById!: number | null;
  @Column({
    name: 'rejected_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  rejectedAt!: Date | null;
  @Column({ name: 'paid_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  paidById!: number | null;
  @Column({ name: 'paid_at', type: 'datetime', precision: 3, nullable: true })
  paidAt!: Date | null;
  @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  createdById!: number | null;
  @Column({ name: 'updated_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  updatedById!: number | null;
  @Column({ type: 'json', nullable: true }) metadata!: JsonRecord | null;
  /** Etapa 4 (M5). Nulos nas despesas antigas ("não classificada"). */
  @Column({ name: 'expense_type', type: 'varchar', length: 20, nullable: true })
  expenseType!: string | null;
  @Column({ name: 'reason_code', type: 'varchar', length: 60, nullable: true })
  reasonCode!: string | null;
  @Column({
    name: 'payment_method',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  paymentMethod!: string | null;
  @Column({
    name: 'invoiced_payment_date',
    type: 'date',
    nullable: true,
    transformer: CIVIL_DATE_TRANSFORMER,
  })
  invoicedPaymentDate!: Date | null;
  @Column({
    name: 'deposited_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  depositedAmount!: string | null;
  @Column({
    name: 'project_sequence',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  projectSequence!: number | null;
  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason!: string | null;
  @Column({
    name: 'reimbursement_batch_id',
    ...FOREIGN_KEY_COLUMN,
    nullable: true,
  })
  reimbursementBatchId!: number | null;
  @Column({
    name: 'reopened_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  reopenedAt!: Date | null;
  @Column({ name: 'reopened_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  reopenedById!: number | null;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  deletedAt!: Date | null;
}
