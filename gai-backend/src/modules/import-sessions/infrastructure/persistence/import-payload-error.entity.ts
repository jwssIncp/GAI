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
import { JsonRecord } from '../../../projects/domain/entities/project';

@Entity('import_payload_errors')
@Index('idx_import_payload_errors_session', ['importSessionId', 'createdAt'])
@Index('idx_import_payload_errors_payload', ['importPayloadId', 'createdAt'])
export class ImportPayloadErrorEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN)
  id!: number;

  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;

  @Column({ name: 'import_session_id', ...FOREIGN_KEY_COLUMN })
  importSessionId!: number;

  @Column({ name: 'import_payload_id', ...FOREIGN_KEY_COLUMN })
  importPayloadId!: number;

  @Column({ name: 'row_number', type: 'int', unsigned: true, nullable: true })
  rowNumber!: number | null;

  @Column({
    name: 'item_reference',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  itemReference!: string | null;

  @Column({ name: 'error_code', type: 'varchar', length: 80 })
  errorCode!: string;

  @Column({ name: 'error_message', type: 'text' })
  errorMessage!: string;

  @Column({ name: 'raw_data', type: 'json', nullable: true })
  rawData!: JsonRecord | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
