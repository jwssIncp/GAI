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
import { ImportFileStatus } from '../../domain/enums/import-file-status.enum';
import { ImportFileType } from '../../domain/enums/import-file-type.enum';

@Entity('import_files')
@Index('idx_import_files_session_status', ['importSessionId', 'status'])
export class ImportFileEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN)
  id!: number;

  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;

  @Column({ name: 'import_session_id', ...FOREIGN_KEY_COLUMN })
  importSessionId!: number;

  @Column({ name: 'import_payload_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  importPayloadId!: number | null;

  @Column({ type: 'varchar', length: 30 })
  type!: ImportFileType;

  @Column({ name: 'storage_provider', type: 'varchar', length: 50 })
  storageProvider!: string;

  @Column({ type: 'varchar', length: 255 })
  bucket!: string;

  @Column({ type: 'varchar', length: 500 })
  path!: string;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType!: string;

  @Column({ name: 'size_bytes', type: 'bigint', unsigned: true })
  sizeBytes!: number;

  @Column({ type: 'varchar', length: 128, nullable: true })
  checksum!: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: ImportFileStatus.PENDING_UPLOAD,
  })
  status!: ImportFileStatus;

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
