import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  FOREIGN_KEY_COLUMN,
  PRIMARY_KEY_COLUMN,
} from '../../common/persistence/entity-id.columns';

export enum ExpenseAccountabilityStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  CANCELLED = 'cancelled',
}

@Entity('expense_accountabilities')
@Index('idx_expense_accountabilities_project_status', ['projectId', 'status'])
export class ExpenseAccountabilityEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ name: 'field_agent_id', ...FOREIGN_KEY_COLUMN })
  fieldAgentId!: number;
  @Column({ name: 'period_start', type: 'date' }) periodStart!: Date;
  @Column({ name: 'period_end', type: 'date' }) periodEnd!: Date;
  @Column({
    type: 'varchar',
    length: 20,
    default: ExpenseAccountabilityStatus.OPEN,
  })
  status!: ExpenseAccountabilityStatus;
  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: '0.00',
  })
  totalAmount!: string;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @Column({ name: 'responsible_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  responsibleById!: number | null;
  @Column({ name: 'closed_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  closedById!: number | null;
  @Column({ name: 'closed_at', type: 'datetime', precision: 3, nullable: true })
  closedAt!: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity('expense_accountability_items')
@Index('uq_expense_accountability_items_expense', ['expenseId'], {
  unique: true,
})
export class ExpenseAccountabilityItemEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ name: 'accountability_id', ...FOREIGN_KEY_COLUMN })
  accountabilityId!: number;
  @Column({ name: 'expense_id', ...FOREIGN_KEY_COLUMN }) expenseId!: number;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}

@Entity('expense_installments')
@Index(
  'uq_expense_installments_expense_number',
  ['expenseId', 'installmentNumber'],
  { unique: true },
)
export class ExpenseInstallmentEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ name: 'expense_id', ...FOREIGN_KEY_COLUMN }) expenseId!: number;
  @Column({ name: 'installment_number', type: 'int', unsigned: true })
  installmentNumber!: number;
  @Column({ name: 'installment_count', type: 'int', unsigned: true })
  installmentCount!: number;
  @Column({ name: 'due_date', type: 'date' }) dueDate!: Date;
  @Column({ type: 'decimal', precision: 15, scale: 2 }) amount!: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) origin!:
    | string
    | null;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}

@Entity('expense_accountability_audit_logs')
@Index('idx_expense_accountability_audit_project', ['projectId', 'createdAt'])
export class ExpenseAccountabilityAuditLogEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ name: 'accountability_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  accountabilityId!: number | null;
  @Column({ name: 'expense_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  expenseId!: number | null;
  @Column({ type: 'varchar', length: 60 }) operation!: string;
  @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true })
  performedBy!: number | null;
  @Column({ type: 'json' }) changes!: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
