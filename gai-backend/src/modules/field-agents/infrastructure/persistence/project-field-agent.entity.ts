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

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate!: Date | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate!: Date | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
