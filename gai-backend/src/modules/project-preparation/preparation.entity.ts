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
  AnswerState,
  PreparationKind,
  PreparationQuestion,
  PreparationSnapshot,
  PreparationStatus,
  PreparationValue,
} from './domain/preparation.types';

abstract class OrganizationRecord {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
@Entity('preparation_templates')
@Index('idx_preparation_templates_org_kind', ['organizationId', 'kind'])
export class PreparationTemplateEntity extends OrganizationRecord {
  @Column({ type: 'varchar', length: 200 }) name!: string;
  @Column({ type: 'varchar', length: 30 }) kind!: PreparationKind;
  @Column({ name: 'current_version', type: 'int', default: 1 })
  currentVersion!: number;
  @Column({
    name: 'archived_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  archivedAt!: Date | null;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
@Entity('preparation_template_versions')
@Index('uq_preparation_template_version', ['templateId', 'version'], {
  unique: true,
})
export class PreparationTemplateVersionEntity extends OrganizationRecord {
  @Column({ name: 'template_id', ...FOREIGN_KEY_COLUMN }) templateId!: number;
  @Column({ type: 'int' }) version!: number;
  @Column({ type: 'varchar', length: 200 }) name!: string;
  @Column({ type: 'json' }) questions!: PreparationQuestion[];
  @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN })
  createdById!: number;
}
@Entity('project_preparations')
@Index('idx_project_preparations_scope', [
  'organizationId',
  'projectId',
  'kind',
])
export class ProjectPreparationEntity extends OrganizationRecord {
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ name: 'template_version_id', ...FOREIGN_KEY_COLUMN })
  templateVersionId!: number;
  @Column({ type: 'varchar', length: 30 }) kind!: PreparationKind;
  @Column({ type: 'varchar', length: 200 }) title!: string;
  @Column({ type: 'json' }) snapshot!: PreparationSnapshot;
  @Column({ type: 'varchar', length: 30, default: 'draft' })
  status!: PreparationStatus;
  @Column({ type: 'int', default: 1 }) revision!: number;
  @Column({
    name: 'responsible_user_id',
    ...FOREIGN_KEY_COLUMN,
    nullable: true,
  })
  responsibleUserId!: number | null;
  @Column({
    name: 'scheduled_date',
    type: 'date',
    nullable: true,
    transformer: CIVIL_DATE_TRANSFORMER,
  })
  scheduledDate!: string | null;
  @Column({
    name: 'due_date',
    type: 'date',
    nullable: true,
    transformer: CIVIL_DATE_TRANSFORMER,
  })
  dueDate!: string | null;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN })
  createdById!: number;
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
@Entity('preparation_answers')
@Index('uq_preparation_answer_question', ['preparationId', 'questionId'], {
  unique: true,
})
@Index('idx_preparation_answers_scope', ['organizationId', 'projectId'])
export class PreparationAnswerEntity extends OrganizationRecord {
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ name: 'preparation_id', ...FOREIGN_KEY_COLUMN })
  preparationId!: number;
  @Column({ name: 'question_id', type: 'varchar', length: 80 })
  questionId!: string;
  @Column({ type: 'varchar', length: 30 }) state!: AnswerState;
  @Column({ type: 'json', nullable: true }) value!: PreparationValue;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @Column({
    name: 'responsible_user_id',
    ...FOREIGN_KEY_COLUMN,
    nullable: true,
  })
  responsibleUserId!: number | null;
  @Column({
    name: 'due_date',
    type: 'date',
    nullable: true,
    transformer: CIVIL_DATE_TRANSFORMER,
  })
  dueDate!: string | null;
  @Column({ name: 'answered_by_id', ...FOREIGN_KEY_COLUMN })
  answeredById!: number;
  @Column({
    name: 'answered_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  answeredAt!: Date | null;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
@Entity('preparation_audit_logs')
@Index('idx_preparation_audit_scope', [
  'organizationId',
  'projectId',
  'preparationId',
  'id',
])
export class PreparationAuditEntity extends OrganizationRecord {
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  projectId!: number | null;
  @Column({ name: 'preparation_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  preparationId!: number | null;
  @Column({ name: 'template_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  templateId!: number | null;
  @Column({ type: 'varchar', length: 60 }) operation!: string;
  @Column({ name: 'performed_by_id', ...FOREIGN_KEY_COLUMN })
  performedById!: number;
  @Column({ type: 'json' }) changes!: Record<string, unknown>;
}
export const PREPARATION_ENTITIES = [
  PreparationTemplateEntity,
  PreparationTemplateVersionEntity,
  ProjectPreparationEntity,
  PreparationAnswerEntity,
  PreparationAuditEntity,
];
