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
import { PaymentStatus } from '../../domain/enums/payment-status.enum';

@Entity('field_agent_payments')
@Index('idx_field_agent_payments_project_status', ['projectId', 'status'])
@Index('idx_field_agent_payments_field_agent', ['fieldAgentId'])
export class FieldAgentPaymentEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ name: 'field_agent_id', ...FOREIGN_KEY_COLUMN })
  fieldAgentId!: number;
  @Column({ type: 'varchar', length: 2, nullable: true }) state!: string | null;
  @Column({ name: 'start_date', type: 'date' }) startDate!: Date;
  @Column({ name: 'end_date', type: 'date' }) endDate!: Date;
  @Column({ name: 'payment_date', type: 'date', nullable: true })
  paymentDate!: Date | null;
  @Column({ type: 'int', unsigned: true, default: 0 }) days!: number;
  @Column({ name: 'daily_rate', type: 'decimal', precision: 15, scale: 2 })
  dailyRate!: string;
  @Column({
    name: 'additional_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  additionalAmount!: string;
  @Column({
    name: 'daily_total',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  dailyTotal!: string;
  @Column({
    name: 'discount_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  discountAmount!: string;
  @Column({
    name: 'final_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  finalAmount!: string;
  @Column({ type: 'varchar', length: 20, default: PaymentStatus.PENDING })
  status!: PaymentStatus;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @Column({ name: 'approved_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  approvedById!: number | null;
  @Column({
    name: 'approved_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  approvedAt!: Date | null;
  @Column({ name: 'paid_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  paidById!: number | null;
  @Column({ name: 'paid_at', type: 'datetime', precision: 3, nullable: true })
  paidAt!: Date | null;
  @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  createdById!: number | null;
  @Column({ name: 'updated_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  updatedById!: number | null;
  @Column({ type: 'json', nullable: true }) metadata!: JsonRecord | null;
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
