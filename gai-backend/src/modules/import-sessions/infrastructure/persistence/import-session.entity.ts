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
import { JsonRecord } from '../../../projects/domain/entities/project';
import { ImportSessionSource } from '../../domain/enums/import-session-source.enum';
import { ImportSessionStatus } from '../../domain/enums/import-session-status.enum';
import { ImportSessionType } from '../../domain/enums/import-session-type.enum';

@Entity('import_sessions')
@Index('idx_import_sessions_org_project_status', [
  'organizationId',
  'projectId',
  'status',
])
@Index('idx_import_sessions_project_created', ['projectId', 'createdAt'])
@Index('idx_import_sessions_session_uuid', ['sessionUuid'], { unique: true })
export class ImportSessionEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN)
  id!: number;

  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;

  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN })
  projectId!: number;

  @Column({ type: 'varchar', length: 40 })
  type!: ImportSessionType;

  @Column({ type: 'varchar', length: 30 })
  source!: ImportSessionSource;

  @Column({ type: 'varchar', length: 20, default: ImportSessionStatus.OPEN })
  status!: ImportSessionStatus;

  @Column({ name: 'session_uuid', type: 'varchar', length: 64 })
  sessionUuid!: string;

  @Column({
    name: 'expected_payloads',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  expectedPayloads!: number | null;

  @Column({
    name: 'received_payloads',
    type: 'int',
    unsigned: true,
    default: 0,
  })
  receivedPayloads!: number;

  @Column({
    name: 'processed_payloads',
    type: 'int',
    unsigned: true,
    default: 0,
  })
  processedPayloads!: number;

  @Column({ name: 'failed_payloads', type: 'int', unsigned: true, default: 0 })
  failedPayloads!: number;

  @Column({ name: 'total_items', type: 'int', unsigned: true, default: 0 })
  totalItems!: number;

  @Column({ name: 'total_images', type: 'int', unsigned: true, default: 0 })
  totalImages!: number;

  @Column({ name: 'total_created', type: 'int', unsigned: true, default: 0 })
  totalCreated!: number;

  @Column({ name: 'total_updated', type: 'int', unsigned: true, default: 0 })
  totalUpdated!: number;

  @Column({ name: 'total_deleted', type: 'int', unsigned: true, default: 0 })
  totalDeleted!: number;

  @Column({ name: 'total_failed', type: 'int', unsigned: true, default: 0 })
  totalFailed!: number;

  @Column({
    name: 'raw_backup_path',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  rawBackupPath!: string | null;

  @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  createdById!: number | null;

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

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'json', nullable: true })
  metadata!: JsonRecord | null;

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
