import { CIVIL_DATE_TRANSFORMER } from '../../../../common/persistence/civil-date.transformer';
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
import { ProjectFieldAgentStatus } from '../../domain/enums/project-field-agent-status.enum';

@Entity('project_field_agents')
@Index('idx_project_field_agents_project_status', ['projectId', 'status'])
@Index('idx_project_field_agents_agent_status', ['fieldAgentId', 'status'])
@Index('uq_project_field_agents_active_key', ['activeAssignmentKey'], {
  unique: true,
})
export class ProjectFieldAgentEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN)
  id!: number;

  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;

  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN })
  projectId!: number;

  @Column({ name: 'field_agent_id', ...FOREIGN_KEY_COLUMN })
  fieldAgentId!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  role!: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: ProjectFieldAgentStatus.ACTIVE,
  })
  status!: ProjectFieldAgentStatus;

  @Column({
    name: 'active_assignment_key',
    type: 'varchar',
    length: 64,
    nullable: true,
    select: false,
    insert: false,
    update: false,
    generatedType: 'STORED',
    asExpression:
      process.env.NODE_ENV === 'test' &&
      process.env.GAI_TEST_MYSQL_DISPOSABLE !== '1'
        ? "CASE WHEN status = 'active' THEN organization_id || ':' || project_id || ':' || field_agent_id ELSE NULL END"
        : "CASE WHEN status = 'active' THEN CONCAT(organization_id, ':', project_id, ':', field_agent_id) ELSE NULL END",
  })
  activeAssignmentKey!: string | null;

  @Column({
    name: 'start_date',
    type: 'date',
    nullable: true,
    transformer: CIVIL_DATE_TRANSFORMER,
  })
  startDate!: Date | null;

  @Column({
    name: 'end_date',
    type: 'date',
    nullable: true,
    transformer: CIVIL_DATE_TRANSFORMER,
  })
  endDate!: Date | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
