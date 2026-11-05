import {
  Column,
  CreateDateColumn,
  Entity,
  ForeignKey,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  FOREIGN_KEY_COLUMN,
  PRIMARY_KEY_COLUMN,
} from '../../../../common/persistence/entity-id.columns';
import { UserEntity } from '../../../auth/infrastructure/persistence/user.entity';
import { OrganizationEntity } from '../../../organizations/infrastructure/persistence/organization.entity';
import { ProjectEntity } from '../../../projects/infrastructure/persistence/project.entity';
import { FieldAgentEntity } from './field-agent.entity';
import { ProjectFieldAgentEntity } from './project-field-agent.entity';

@Entity('field_agent_audit_logs')
@ForeignKey(() => OrganizationEntity, ['organizationId'], ['id'], {
  name: 'fk_field_agent_audit_organization',
})
@ForeignKey(() => FieldAgentEntity, ['fieldAgentId'], ['id'], {
  name: 'fk_field_agent_audit_field_agent',
})
@ForeignKey(() => ProjectFieldAgentEntity, ['projectFieldAgentId'], ['id'], {
  name: 'fk_field_agent_audit_project_field_agent',
})
@ForeignKey(() => ProjectEntity, ['projectId'], ['id'], {
  name: 'fk_field_agent_audit_project',
})
@ForeignKey(() => UserEntity, ['performedBy'], ['id'], {
  name: 'fk_field_agent_audit_performed_by',
})
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
