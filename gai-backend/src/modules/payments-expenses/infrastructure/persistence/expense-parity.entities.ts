import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CIVIL_DATE_TRANSFORMER } from '../../../../common/persistence/civil-date.transformer';
import {
  FOREIGN_KEY_COLUMN,
  PRIMARY_KEY_COLUMN,
} from '../../../../common/persistence/entity-id.columns';

/** Status do lote de reembolso ao cliente (decisão D-B). */
export enum ReimbursementBatchStatus {
  OPEN = 'open',
  BILLED = 'billed',
  RECEIVED = 'received',
  CANCELLED = 'cancelled',
}

/** M7: lote de reembolso ao cliente ("prestar conta" na lista de despesas). */
@Entity('expense_reimbursement_batches')
@Index('uq_reimbursement_batch_number', ['projectId', 'number'], {
  unique: true,
})
export class ExpenseReimbursementBatchEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ type: 'int', unsigned: true }) number!: number;
  @Column({
    name: 'batch_date',
    type: 'date',
    transformer: CIVIL_DATE_TRANSFORMER,
  })
  batchDate!: string;
  @Column({
    name: 'expected_receipt_on',
    type: 'date',
    nullable: true,
    transformer: CIVIL_DATE_TRANSFORMER,
  })
  expectedReceiptOn!: string | null;
  @Column({
    type: 'varchar',
    length: 20,
    default: ReimbursementBatchStatus.OPEN,
  })
  status!: ReimbursementBatchStatus;
  @Column({ name: 'receivable_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  receivableId!: number | null;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  createdById!: number | null;
  @Column({ name: 'billed_at', type: 'datetime', precision: 3, nullable: true })
  billedAt!: Date | null;
  @Column({ name: 'billed_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  billedById!: number | null;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

/** M6: adiantamento ao técnico, por projeto (decisão 3). */
@Entity('expense_advances')
@Index('idx_expense_advances_project_agent', ['projectId', 'fieldAgentId'])
export class ExpenseAdvanceEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ name: 'field_agent_id', ...FOREIGN_KEY_COLUMN })
  fieldAgentId!: number;
  @Column({
    name: 'advanced_on',
    type: 'date',
    transformer: CIVIL_DATE_TRANSFORMER,
  })
  advancedOn!: string;
  @Column({ type: 'decimal', precision: 15, scale: 2 }) amount!: string;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @Column({
    name: 'deposited_by_user_id',
    ...FOREIGN_KEY_COLUMN,
    nullable: true,
  })
  depositedByUserId!: number | null;
  @Column({
    name: 'deposited_by_name',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  depositedByName!: string | null;
  @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  createdById!: number | null;
  @Column({ name: 'updated_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  updatedById!: number | null;
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

/** M8: concluir/reabrir o financeiro do projeto, sem mexer no status do projeto. */
@Entity('project_financial_closures')
@Index('idx_project_financial_closures_project', ['projectId', 'reopenedAt'])
export class ProjectFinancialClosureEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ name: 'closed_at', type: 'datetime', precision: 3 })
  closedAt!: Date;
  @Column({ name: 'closed_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  closedById!: number | null;
  @Column({ name: 'close_reason', type: 'text' }) closeReason!: string;
  @Column({
    name: 'reopened_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  reopenedAt!: Date | null;
  @Column({ name: 'reopened_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  reopenedById!: number | null;
  @Column({ name: 'reopen_reason', type: 'text', nullable: true })
  reopenReason!: string | null;
}
