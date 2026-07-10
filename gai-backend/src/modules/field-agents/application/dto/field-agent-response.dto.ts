import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FieldAgent, JsonRecord } from '../../domain/entities/field-agent';
import { ProjectFieldAgent } from '../../domain/entities/project-field-agent';
import { FieldAgentStatus } from '../../domain/enums/field-agent-status.enum';
import { ProjectFieldAgentStatus } from '../../domain/enums/project-field-agent-status.enum';

export class FieldAgentResponseDto {
  @ApiProperty({ type: 'integer', format: 'int64' })
  id!: number;

  @ApiProperty({ type: 'integer', format: 'int64' })
  organization_id!: number;

  @ApiPropertyOptional({ type: 'integer', format: 'int64', nullable: true })
  user_id!: number | null;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone!: string | null;

  @ApiPropertyOptional({ nullable: true })
  document!: string | null;

  @ApiProperty({ enum: FieldAgentStatus })
  status!: FieldAgentStatus;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  metadata!: JsonRecord | null;

  @ApiProperty({ format: 'date-time' })
  created_at!: string;

  @ApiProperty({ format: 'date-time' })
  updated_at!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  deleted_at!: string | null;

  static fromDomain(fieldAgent: FieldAgent): FieldAgentResponseDto {
    return {
      id: fieldAgent.id,
      organization_id: fieldAgent.organizationId,
      user_id: fieldAgent.userId,
      name: fieldAgent.name,
      email: fieldAgent.email,
      phone: fieldAgent.phone,
      document: fieldAgent.document,
      status: fieldAgent.status,
      metadata: fieldAgent.metadata,
      created_at: fieldAgent.createdAt.toISOString(),
      updated_at: fieldAgent.updatedAt.toISOString(),
      deleted_at: fieldAgent.deletedAt?.toISOString() ?? null,
    };
  }
}

export class FieldAgentListResponseDto {
  @ApiProperty({ type: [FieldAgentResponseDto] })
  items!: FieldAgentResponseDto[];

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  page_size!: number;

  @ApiProperty({ minimum: 0 })
  total_items!: number;

  @ApiProperty({ minimum: 0 })
  total_pages!: number;
}

export class ProjectFieldAgentResponseDto {
  @ApiProperty({ type: 'integer', format: 'int64' })
  id!: number;

  @ApiProperty({ type: 'integer', format: 'int64' })
  organization_id!: number;

  @ApiProperty({ type: 'integer', format: 'int64' })
  project_id!: number;

  @ApiProperty({ type: 'integer', format: 'int64' })
  field_agent_id!: number;

  @ApiPropertyOptional({ nullable: true })
  role!: string | null;

  @ApiProperty({ enum: ProjectFieldAgentStatus })
  status!: ProjectFieldAgentStatus;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  start_date!: string | null;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  end_date!: string | null;

  @ApiPropertyOptional({ nullable: true })
  notes!: string | null;

  @ApiProperty({ format: 'date-time' })
  created_at!: string;

  @ApiProperty({ format: 'date-time' })
  updated_at!: string;

  static fromDomain(
    assignment: ProjectFieldAgent,
  ): ProjectFieldAgentResponseDto {
    return {
      id: assignment.id,
      organization_id: assignment.organizationId,
      project_id: assignment.projectId,
      field_agent_id: assignment.fieldAgentId,
      role: assignment.role,
      status: assignment.status,
      start_date: assignment.startDate
        ? assignment.startDate.toISOString().slice(0, 10)
        : null,
      end_date: assignment.endDate
        ? assignment.endDate.toISOString().slice(0, 10)
        : null,
      notes: assignment.notes,
      created_at: assignment.createdAt.toISOString(),
      updated_at: assignment.updatedAt.toISOString(),
    };
  }
}

export class ProjectFieldAgentListResponseDto {
  @ApiProperty({ type: [ProjectFieldAgentResponseDto] })
  items!: ProjectFieldAgentResponseDto[];

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  page_size!: number;

  @ApiProperty({ minimum: 0 })
  total_items!: number;

  @ApiProperty({ minimum: 0 })
  total_pages!: number;
}
