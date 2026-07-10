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

@Entity('field_agent_audit_logs')
@Index('idx_field_agent_audit_agent_created', ['fieldAgentId', 'createdAt'])
@Index('idx_field_agent_audit_project_created', ['projectId', 'createdAt'])
export class FieldAgentAuditLogEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN)
  id!: number;

  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;

  @Column({ name: 'field_agent_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  fieldAgentId!: number | null;

  @Column({
    name: 'project_field_agent_id',
    ...FOREIGN_KEY_COLUMN,
    nullable: true,
  })
  projectFieldAgentId!: number | null;

  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  projectId!: number | null;

  @Column({ type: 'varchar', length: 50 })
  operation!: string;

  @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true })
  performedBy!: number | null;

  @Column({ type: 'json' })
  changes!: Record<string, { before: unknown; after: unknown }>;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
