import { ProjectType } from '../../domain/enums/project-type.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JsonRecord, Project } from '../../domain/entities/project';
import { ProjectStatus } from '../../domain/enums/project-status.enum';
import { ProjectStatusTransitionPolicy } from '../../domain/services/project-status-transition.policy';
import type { ProjectLifecycleAction } from '../../domain/services/project-status-transition.policy';

const PROJECT_LIFECYCLE_ACTIONS: ProjectLifecycleAction[] = [
  'activate',
  'pause',
  'resume',
  'finish',
  'cancel',
  'archive',
];

export class ProjectAvailableActionDto {
  @ApiProperty({ enum: PROJECT_LIFECYCLE_ACTIONS })
  action!: ProjectLifecycleAction;

  @ApiProperty({ example: 'projects:activate' })
  permission!: string;
}

export class ProjectResponseDto {
  @ApiProperty({ type: 'integer', format: 'int64' })
  id!: number;

  @ApiProperty({ type: 'integer', format: 'int64' })
  organization_id!: number;

  @ApiPropertyOptional({ type: 'integer', format: 'int64', nullable: true })
  company_id!: number | null;

  @ApiProperty()
  name!: string;
  @ApiPropertyOptional({ nullable: true }) code!: string | null;
  @ApiPropertyOptional({ enum: ProjectType, nullable: true })
  project_type!: ProjectType | null;
  @ApiPropertyOptional({ nullable: true }) responsible_user_id!: number | null;
  @ApiPropertyOptional({ nullable: true }) planning_responsible_user_id!:
    | number
    | null;
  @ApiPropertyOptional({ nullable: true }) planning_notes!: string | null;
  @ApiPropertyOptional({ nullable: true }) company_name!: string | null;
  @ApiPropertyOptional({ nullable: true }) responsible_user_name!:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true }) planning_responsible_user_name!:
    | string
    | null;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty({ enum: ProjectStatus })
  status!: ProjectStatus;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  start_date!: string | null;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  end_date!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  finished_at!: string | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  settings!: JsonRecord | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  metadata!: JsonRecord | null;

  @ApiPropertyOptional({ type: 'integer', format: 'int64', nullable: true })
  created_by_id!: number | null;

  @ApiPropertyOptional({ type: 'integer', format: 'int64', nullable: true })
  updated_by_id!: number | null;

  @ApiProperty({ format: 'date-time' })
  created_at!: string;

  @ApiProperty({ format: 'date-time' })
  updated_at!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  deleted_at!: string | null;

  @ApiProperty({ type: [ProjectAvailableActionDto] })
  available_actions!: ProjectAvailableActionDto[];

  static fromDomain(project: Project): ProjectResponseDto {
    return {
      id: project.id,
      organization_id: project.organizationId,
      company_id: project.companyId,
      name: project.name,
      code: project.code,
      project_type: project.projectType,
      responsible_user_id: project.responsibleUserId,
      planning_responsible_user_id: project.planningResponsibleUserId,
      planning_notes: project.planningNotes,
      company_name: project.companyName,
      responsible_user_name: project.responsibleUserName,
      planning_responsible_user_name: project.planningResponsibleUserName,
      description: project.description,
      status: project.status,
      start_date: project.startDate
        ? project.startDate.toISOString().slice(0, 10)
        : null,
      end_date: project.endDate
        ? project.endDate.toISOString().slice(0, 10)
        : null,
      finished_at: project.finishedAt?.toISOString() ?? null,
      settings: project.settings,
      metadata: project.metadata,
      created_by_id: project.createdById,
      updated_by_id: project.updatedById,
      created_at: project.createdAt.toISOString(),
      updated_at: project.updatedAt.toISOString(),
      deleted_at: project.deletedAt?.toISOString() ?? null,
      available_actions: ProjectStatusTransitionPolicy.availableActions(
        project.status,
      ),
    };
  }
}

export class ProjectListResponseDto {
  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  status_counts!: Partial<Record<ProjectStatus, number>>;
  @ApiProperty({ type: [ProjectResponseDto] })
  items!: ProjectResponseDto[];

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  page_size!: number;

  @ApiProperty({ minimum: 0 })
  total_items!: number;

  @ApiProperty({ minimum: 0 })
  total_pages!: number;
}
