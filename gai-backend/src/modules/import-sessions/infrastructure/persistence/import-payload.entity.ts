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
import { JsonRecord } from '../../../projects/domain/entities/project';
import { ImportPayloadStatus } from '../../domain/enums/import-payload-status.enum';

@Entity('import_payloads')
@Index(
  'idx_import_payloads_session_number',
  ['importSessionId', 'payloadNumber'],
  { unique: true },
)
@Index(
  'idx_import_payloads_session_key',
  ['importSessionId', 'idempotencyKey'],
  { unique: true },
)
@Index('idx_import_payloads_org_status', ['organizationId', 'status'])
export class ImportPayloadEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN)
  id!: number;

  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;

  @Column({ name: 'import_session_id', ...FOREIGN_KEY_COLUMN })
  importSessionId!: number;

  @Column({ name: 'payload_number', type: 'int', unsigned: true })
  payloadNumber!: number;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 128 })
  idempotencyKey!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  checksum!: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: ImportPayloadStatus.RECEIVED,
  })
  status!: ImportPayloadStatus;

  @Column({ name: 'items_count', type: 'int', unsigned: true, default: 0 })
  itemsCount!: number;

  @Column({ name: 'images_count', type: 'int', unsigned: true, default: 0 })
  imagesCount!: number;

  @Column({ name: 'created_count', type: 'int', unsigned: true, default: 0 })
  createdCount!: number;

  @Column({ name: 'updated_count', type: 'int', unsigned: true, default: 0 })
  updatedCount!: number;

  @Column({ name: 'deleted_count', type: 'int', unsigned: true, default: 0 })
  deletedCount!: number;

  @Column({ name: 'failed_count', type: 'int', unsigned: true, default: 0 })
  failedCount!: number;

  @Column({
    name: 'raw_payload_path',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  rawPayloadPath!: string | null;

  @Column({ name: 'received_at', type: 'datetime', precision: 3 })
  receivedAt!: Date;

  @Column({
    name: 'processed_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  processedAt!: Date | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'json', nullable: true })
  metadata!: JsonRecord | null;

  @Column({ type: 'json', nullable: true })
  payload!: JsonRecord | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
