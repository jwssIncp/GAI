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
import { ExportJobStatus } from '../../domain/enums/export-job-status.enum';
import { ExportJobType } from '../../domain/enums/export-job-type.enum';

@Entity('export_jobs')
@Index('idx_export_jobs_org_project_status', [
  'organizationId',
  'projectId',
  'status',
])
@Index('idx_export_jobs_project_type_created', [
  'projectId',
  'type',
  'createdAt',
])
@Index('idx_export_jobs_status_created', ['status', 'createdAt'])
@Index('idx_export_jobs_expires_at', ['expiresAt'])
export class ExportJobEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN)
  id!: number;

  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;

  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN })
  projectId!: number;

  @Column({ type: 'varchar', length: 60 })
  type!: ExportJobType;

  @Column({ type: 'varchar', length: 20, default: ExportJobStatus.PENDING })
  status!: ExportJobStatus;

  @Column({ name: 'file_name', type: 'varchar', length: 255, nullable: true })
  fileName!: string | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 120, nullable: true })
  mimeType!: string | null;

  @Column({
    name: 'size_bytes',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  sizeBytes!: number | null;

  @Column({
    name: 'file_content',
    type: process.env.NODE_ENV === 'test' ? 'blob' : 'mediumblob',
    nullable: true,
    select: false,
  })
  fileContent!: Buffer | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  checksum!: string | null;

  @Column({ name: 'requested_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  requestedById!: number | null;

  @Column({ name: 'retry_of_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  retryOfId!: number | null;

  @Column({ name: 'attempt_count', type: 'int', unsigned: true, default: 1 })
  attemptCount!: number;

  @Column({ name: 'requested_at', type: 'datetime', precision: 3 })
  requestedAt!: Date;

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

  @Column({
    name: 'expires_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  expiresAt!: Date | null;

  @Column({ name: 'error_code', type: 'varchar', length: 100, nullable: true })
  errorCode!: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

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
