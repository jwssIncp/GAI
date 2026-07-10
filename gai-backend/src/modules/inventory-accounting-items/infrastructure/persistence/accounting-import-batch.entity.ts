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
} from '../../../../common/persistence/entity-id.columns';
import { JsonRecord } from '../../domain/entities/inventory-accounting-item';
import { AccountingImportBatchStatus } from '../../domain/enums/accounting-import-batch-status.enum';

@Entity('accounting_import_batches')
@Index('idx_accounting_import_batches_project_status', ['projectId', 'status'])
@Index('idx_accounting_import_batches_organization_project', [
  'organizationId',
  'projectId',
])
export class AccountingImportBatchEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN)
  id!: number;

  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;

  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN })
  projectId!: number;

  @Column({ name: 'original_file_name', type: 'varchar', length: 255 })
  originalFileName!: string;

  @Column({
    name: 'storage_provider',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  storageProvider!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  bucket!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  path!: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: AccountingImportBatchStatus.PENDING,
  })
  status!: AccountingImportBatchStatus;

  @Column({ name: 'total_rows', type: 'int', unsigned: true, default: 0 })
  totalRows!: number;

  @Column({ name: 'processed_rows', type: 'int', unsigned: true, default: 0 })
  processedRows!: number;

  @Column({ name: 'success_rows', type: 'int', unsigned: true, default: 0 })
  successRows!: number;

  @Column({ name: 'failed_rows', type: 'int', unsigned: true, default: 0 })
  failedRows!: number;

  @Column({
    name: 'error_report_path',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  errorReportPath!: string | null;

  @Column({ name: 'imported_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  importedById!: number | null;

  @Column({
    name: 'started_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  startedAt!: Date | null;

  @Column({
    name: 'finished_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  finishedAt!: Date | null;

  @Column({ type: 'json', nullable: true })
  metadata!: JsonRecord | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
