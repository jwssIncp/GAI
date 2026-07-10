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
import type { JsonRecord } from '../../../projects/domain/entities/project';
import { ImportOperation } from '../../domain/enums/import-operation.enum';

@Entity('import_session_audit_logs')
@Index('idx_import_session_audit_project_created', ['projectId', 'createdAt'])
export class ImportSessionAuditLogEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN)
  id!: number;

  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;

  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN })
  projectId!: number;

  @Column({ name: 'import_session_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  importSessionId!: number | null;

  @Column({ name: 'import_payload_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  importPayloadId!: number | null;

  @Column({ name: 'import_file_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  importFileId!: number | null;

  @Column({ type: 'varchar', length: 60 })
  operation!: ImportOperation;

  @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true })
  performedBy!: number | null;

  @Column({ type: 'json' })
  changes!: JsonRecord;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
