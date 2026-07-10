import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  FOREIGN_KEY_COLUMN,
  PRIMARY_KEY_COLUMN,
} from '../../../../common/persistence/entity-id.columns';

@Entity('payment_expense_audit_logs')
@Index('idx_payment_expense_audit_project_created', ['projectId', 'createdAt'])
export class PaymentExpenseAuditLogEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ name: 'payment_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  paymentId!: number | null;
  @Column({ name: 'expense_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  expenseId!: number | null;
  @Column({
    name: 'expense_attachment_id',
    ...FOREIGN_KEY_COLUMN,
    nullable: true,
  })
  expenseAttachmentId!: number | null;
  @Column({ type: 'varchar', length: 60 }) operation!: string;
  @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true })
  performedBy!: number | null;
  @Column({ type: 'json' }) changes!: Record<
    string,
    { before: unknown; after: unknown }
  >;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
