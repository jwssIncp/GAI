import { ProjectType } from '../../domain/enums/project-type.enum';
import { CIVIL_DATE_TRANSFORMER } from '../../../../common/persistence/civil-date.transformer';
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
import { JsonRecord } from '../../domain/entities/project';
import { ProjectStatus } from '../../domain/enums/project-status.enum';

@Entity('projects')
@Index('uq_field_project_scope', ['id', 'organizationId'], { unique: true })
@Index('uq_projects_organization_code', ['organizationId', 'code'], {
  unique: true,
})
@Index('idx_projects_organization_type', ['organizationId', 'projectType'])
@Index('idx_projects_responsible', ['responsibleUserId'])
@Index('idx_projects_planning_responsible', ['planningResponsibleUserId'])
@Index('idx_projects_organization_status', ['organizationId', 'status'])
@Index('idx_projects_name', ['name'])
export class ProjectEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN)
  id!: number;

  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;

  @Column({ name: 'company_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  companyId!: number | null;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  code!: string | null;
  @Column({ name: 'project_type', type: 'varchar', length: 30, nullable: true })
  projectType!: ProjectType | null;
  @Column({
    name: 'responsible_user_id',
    ...FOREIGN_KEY_COLUMN,
    nullable: true,
  })
  responsibleUserId!: number | null;
  @Column({
    name: 'planning_responsible_user_id',
    ...FOREIGN_KEY_COLUMN,
    nullable: true,
  })
  planningResponsibleUserId!: number | null;
  @Column({ name: 'planning_notes', type: 'text', nullable: true })
  planningNotes!: string | null;
  // Labels are hydrated with scoped joins and are not stored twice.
  companyName?: string | null;
  responsibleUserName?: string | null;
  planningResponsibleUserName?: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 20, default: ProjectStatus.DRAFT })
  status!: ProjectStatus;

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

  @Column({
    name: 'finished_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  finishedAt!: Date | null;

  @Column({ type: 'json', nullable: true })
  settings!: JsonRecord | null;

  @Column({ type: 'json', nullable: true })
  metadata!: JsonRecord | null;

  @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  createdById!: number | null;

  @Column({ name: 'updated_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  updatedById!: number | null;

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
