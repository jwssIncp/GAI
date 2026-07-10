import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { ProjectStatus } from '../../../projects/domain/enums/project-status.enum';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from '../../../projects/domain/ports/project.repository.port';
import { FieldAgentAuditOperation } from '../../domain/enums/field-agent-audit-operation.enum';
import {
  FIELD_AGENT_REPOSITORY,
  type FieldAgentRepository,
} from '../../domain/ports/field-agent.repository.port';
import { ProjectFieldAgentResponseDto } from '../dto/field-agent-response.dto';
import { UpdateProjectFieldAgentDto } from '../dto/project-field-agent.dto';
import {
  FieldAgentActorContext,
  FieldAgentScopeService,
} from '../services/field-agent-scope.service';

@Injectable()
export class UpdateProjectFieldAgentUseCase {
  constructor(
    @Inject(FIELD_AGENT_REPOSITORY)
    private readonly repository: FieldAgentRepository,
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepository,
    private readonly scope: FieldAgentScopeService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UpdateProjectFieldAgentUseCase.name);
  }

  async execute(
    projectId: number,
    assignmentId: number,
    dto: UpdateProjectFieldAgentDto,
    actor: FieldAgentActorContext,
  ): Promise<ProjectFieldAgentResponseDto> {
    const project = await this.projects.findById(projectId);
    if (!project) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Project not found',
      });
    }
    this.scope.assertCanAccessOrganization(actor, project.organizationId);
    this.assertProjectAllowsMutation(project.status);

    const assignment = await this.repository.findAssignmentById(assignmentId);
    if (!assignment || assignment.projectId !== projectId) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Project field agent not found',
      });
    }

    let changes: Record<string, { before: unknown; after: unknown }>;
    try {
      changes = assignment.updateFields({
        role: dto.role !== undefined ? (dto.role?.trim() ?? null) : undefined,
        status: dto.status,
        startDate: this.parseDate(dto.start_date),
        endDate: this.parseDate(dto.end_date),
        notes:
          dto.notes !== undefined ? (dto.notes?.trim() ?? null) : undefined,
      });
    } catch (error) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message:
          error instanceof Error
            ? error.message
            : 'Invalid project field agent',
      });
    }

    if (Object.keys(changes).length === 0) {
      return ProjectFieldAgentResponseDto.fromDomain(assignment);
    }

    const saved = await this.repository.saveAssignmentWithAudit(assignment, {
      organizationId: assignment.organizationId,
      fieldAgentId: assignment.fieldAgentId,
      projectFieldAgentId: assignment.id,
      projectId: assignment.projectId,
      operation: FieldAgentAuditOperation.UPDATE_PROJECT_ASSIGNMENT,
      performedBy: actor.id,
      changes,
    });

    this.logger.info({
      operation: 'UPDATE_PROJECT_FIELD_AGENT',
      projectFieldAgentId: saved.id,
      projectId: saved.projectId,
      organizationId: saved.organizationId,
      result: 'SUCCESS',
    });

    return ProjectFieldAgentResponseDto.fromDomain(saved);
  }

  private assertProjectAllowsMutation(status: ProjectStatus): void {
    if (
      [
        ProjectStatus.INACTIVE,
        ProjectStatus.FINISHED,
        ProjectStatus.CANCELLED,
        ProjectStatus.ARCHIVED,
      ].includes(status)
    ) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Project status blocks this operation',
      });
    }
  }

  private parseDate(value: string | null | undefined): Date | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    return value ? new Date(`${value}T00:00:00.000Z`) : null;
  }
}
