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

@Entity('user_audit_logs')
@Index('idx_user_audit_user_created', ['userId', 'createdAt'])
export class UserAuditLogEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN)
  id!: number;

  @Column({ name: 'user_id', ...FOREIGN_KEY_COLUMN })
  userId!: number;

  @Column({ type: 'varchar', length: 50 })
  operation!: string;

  @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true })
  performedBy!: number | null;

  @Column({ type: 'json' })
  changes!: Record<string, { before: unknown; after: unknown }>;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
