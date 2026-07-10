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
import { ExpenseAttachmentStatus } from '../../domain/enums/expense-attachment-status.enum';

@Entity('expense_attachments')
@Index('idx_expense_attachments_expense_status', ['expenseId', 'status'])
export class ExpenseAttachmentEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'expense_id', ...FOREIGN_KEY_COLUMN }) expenseId!: number;
  @Column({ name: 'storage_provider', type: 'varchar', length: 50 })
  storageProvider!: string;
  @Column({ type: 'varchar', length: 255 }) bucket!: string;
  @Column({ type: 'varchar', length: 500 }) path!: string;
  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName!: string;
  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType!: string;
  @Column({ name: 'size_bytes', type: 'bigint', unsigned: true })
  sizeBytes!: number;
  @Column({ type: 'varchar', length: 128, nullable: true }) checksum!:
    | string
    | null;
  @Column({
    type: 'varchar',
    length: 20,
    default: ExpenseAttachmentStatus.PENDING_UPLOAD,
  })
  status!: ExpenseAttachmentStatus;
  @Column({ name: 'uploaded_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  uploadedById!: number | null;
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
