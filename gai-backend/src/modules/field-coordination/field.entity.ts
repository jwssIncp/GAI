import { CIVIL_DATE_TRANSFORMER } from '../../common/persistence/civil-date.transformer';
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
} from '../../common/persistence/entity-id.columns';
import type {
  FieldDefinition,
  FieldTaskDefinition,
  Priority,
  TaskState,
} from './field.policy';
abstract class OrganizationRow {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
@Entity('field_templates')
@Index('idx_field_templates_org', ['organizationId', 'archivedAt'])
export class FieldTemplate extends OrganizationRow {
  @Column({ length: 200 }) name!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ name: 'current_version', type: 'int' }) currentVersion!: number;
  @Column({
    name: 'archived_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  archivedAt!: Date | null;
}
@Entity('field_template_versions')
@Index('uq_field_template_version', ['templateId', 'version'], { unique: true })
export class FieldTemplateVersion extends OrganizationRow {
  @Column({ name: 'template_id', ...FOREIGN_KEY_COLUMN }) templateId!: number;
  @Column({ type: 'int' }) version!: number;
  @Column({ length: 200 }) name!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ type: 'json' }) definition!: FieldDefinition;
  @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN })
  createdById!: number;
}
@Entity('field_checklists')
@Index('idx_field_checklists_scope', ['organizationId', 'projectId'])
export class FieldChecklist extends OrganizationRow {
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ name: 'template_version_id', ...FOREIGN_KEY_COLUMN })
  templateVersionId!: number;
  @Column({ length: 200 }) title!: string;
  @Column({ type: 'json' }) snapshot!: FieldDefinition & {
    name: string;
    version: number;
  };
  @Column({ length: 30, default: 'open' }) status!:
    | 'open'
    | 'completed'
    | 'archived';
  @Column({ type: 'int', default: 1 }) revision!: number;
  @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN })
  createdById!: number;
  @Column({ name: 'completed_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  completedById!: number | null;
  @Column({
    name: 'completed_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  completedAt!: Date | null;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
@Entity('field_tasks')
@Index('uq_field_task_stable', ['checklistId', 'stableId'], { unique: true })
@Index('idx_field_task_filter', [
  'organizationId',
  'projectId',
  'checklistId',
  'state',
  'dueDate',
])
export class FieldTask extends OrganizationRow {
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ name: 'checklist_id', ...FOREIGN_KEY_COLUMN }) checklistId!: number;
  @Column({ name: 'stable_id', length: 80 }) stableId!: string;
  @Column({ name: 'group_id', length: 80 }) groupId!: string;
  @Column({ length: 200 }) title!: string;
  @Column({ type: 'json' }) definition!: FieldTaskDefinition;
  @Column({ type: 'int' }) position!: number;
  @Column({ type: 'boolean' }) required!: boolean;
  @Column({ type: 'boolean', default: true }) applicable!: boolean;
  @Column({ type: 'varchar', length: 30, default: 'pending' })
  state!: TaskState;
  @Column({ type: 'varchar', length: 20, default: 'normal' })
  priority!: Priority;
  @Column({
    name: 'responsible_user_id',
    ...FOREIGN_KEY_COLUMN,
    nullable: true,
  })
  responsibleUserId!: number | null;
  @Column({ name: 'field_agent_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  fieldAgentId!: number | null;
  @Column({
    name: 'start_date',
    type: 'date',
    nullable: true,
    transformer: CIVIL_DATE_TRANSFORMER,
  })
  startDate!: string | null;
  @Column({
    name: 'due_date',
    type: 'date',
    nullable: true,
    transformer: CIVIL_DATE_TRANSFORMER,
  })
  dueDate!: string | null;
  @Column({
    name: 'completed_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  completedAt!: Date | null;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @Column({ type: 'text', nullable: true }) reason!: string | null;
  @Column({ name: 'linked_issue_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  linkedIssueId!: number | null;
  @Column({ name: 'approved_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  approvedById!: number | null;
  @Column({
    name: 'approved_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  approvedAt!: Date | null;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
@Entity('field_audit_logs')
@Index('idx_field_audit_scope', [
  'organizationId',
  'projectId',
  'checklistId',
  'id',
])
export class FieldAudit extends OrganizationRow {
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  projectId!: number | null;
  @Column({ name: 'checklist_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  checklistId!: number | null;
  @Column({ name: 'template_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  templateId!: number | null;
  @Column({ name: 'performed_by_id', ...FOREIGN_KEY_COLUMN })
  performedById!: number;
  @Column({ length: 60 }) operation!: string;
  @Column({ type: 'json' }) changes!: object;
}
@Entity('field_commands')
@Index('uq_field_command', ['organizationId', 'projectId', 'commandKey'], {
  unique: true,
})
export class FieldCommand extends OrganizationRow {
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ name: 'command_key', length: 80 }) commandKey!: string;
  @Column({ length: 64 }) fingerprint!: string;
  @Column({ type: 'json', nullable: true }) result!: object | null;
}
export const FIELD_ENTITIES = [
  FieldTemplate,
  FieldTemplateVersion,
  FieldChecklist,
  FieldTask,
  FieldAudit,
  FieldCommand,
];
