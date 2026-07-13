import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from '../../../projects/domain/ports/project.repository.port';
import { ProjectFieldAgent } from '../../domain/entities/project-field-agent';
import { FieldAgentAuditOperation } from '../../domain/enums/field-agent-audit-operation.enum';
import { ProjectFieldAgentStatus } from '../../domain/enums/project-field-agent-status.enum';
import {
  FIELD_AGENT_REPOSITORY,
  type FieldAgentRepository,
} from '../../domain/ports/field-agent.repository.port';
import { ProjectFieldAgentResponseDto } from '../dto/field-agent-response.dto';
import { AssignProjectFieldAgentDto } from '../dto/project-field-agent.dto';
import {
  ActiveAssignmentExistsError,
  activeAssignmentConflict,
  isActiveAssignmentDuplicate,
} from '../errors/field-agent-conflict';
import {
  assertProjectAllowsFieldAgentMutation,
  ProjectStatusBlocksFieldAgentOperationError,
  projectStatusBlocksFieldAgentOperation,
} from '../errors/project-status-blocks-operation';
import {
  FieldAgentActorContext,
  FieldAgentScopeService,
} from '../services/field-agent-scope.service';

@Injectable()
export class AssignProjectFieldAgentUseCase {
  constructor(
    @Inject(FIELD_AGENT_REPOSITORY)
    private readonly repository: FieldAgentRepository,
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepository,
    private readonly scope: FieldAgentScopeService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AssignProjectFieldAgentUseCase.name);
  }

  async execute(
    projectId: number,
    dto: AssignProjectFieldAgentDto,
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
    assertProjectAllowsFieldAgentMutation(project.status);

    const fieldAgent = await this.repository.findById(dto.field_agent_id);
    if (!fieldAgent) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Field agent not found',
      });
    }
    if (fieldAgent.organizationId !== project.organizationId) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Field agent and project must belong to the same organization',
      });
    }
    if (!fieldAgent.isActive()) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Only active field agents can be assigned to projects',
      });
    }
    if (
      await this.repository.hasActiveAssignment(
        project.organizationId,
        projectId,
        dto.field_agent_id,
      )
    ) {
      throw activeAssignmentConflict();
    }

    const now = new Date();
    let assignment: ProjectFieldAgent;
    try {
      assignment = new ProjectFieldAgent({
        id: 0,
        organizationId: project.organizationId,
        projectId,
        fieldAgentId: dto.field_agent_id,
        role: dto.role?.trim() ?? null,
        status: ProjectFieldAgentStatus.ACTIVE,
        startDate: this.parseDate(dto.start_date),
        endDate: this.parseDate(dto.end_date),
        notes: dto.notes?.trim() ?? null,
        createdAt: now,
        updatedAt: now,
      });
    } catch (error) {
      throw this.validation(error);
    }

    let saved: ProjectFieldAgent;
    try {
      saved = await this.repository.saveAssignmentEnsuringUniqueActive(
        assignment,
        {
          organizationId: assignment.organizationId,
          fieldAgentId: assignment.fieldAgentId,
          projectFieldAgentId: 0,
          projectId: assignment.projectId,
          operation: FieldAgentAuditOperation.ASSIGN_TO_PROJECT,
          performedBy: actor.id,
          changes: {
            field_agent_id: { before: null, after: assignment.fieldAgentId },
            project_id: { before: null, after: assignment.projectId },
            status: { before: null, after: assignment.status },
          },
        },
      );
    } catch (error) {
      if (
        error instanceof ActiveAssignmentExistsError ||
        isActiveAssignmentDuplicate(error)
      ) {
        throw activeAssignmentConflict();
      }
      if (error instanceof ProjectStatusBlocksFieldAgentOperationError) {
        throw projectStatusBlocksFieldAgentOperation(error.currentStatus);
      }
      throw error;
    }

    this.logger.info({
      operation: 'ASSIGN_PROJECT_FIELD_AGENT',
      projectFieldAgentId: saved.id,
      projectId: saved.projectId,
      fieldAgentId: saved.fieldAgentId,
      organizationId: saved.organizationId,
      result: 'SUCCESS',
    });

    return ProjectFieldAgentResponseDto.fromDomain(saved);
  }

  private parseDate(value: string | null | undefined): Date | null {
    return value ? new Date(`${value}T00:00:00.000Z`) : null;
  }

  private validation(error: unknown): BadRequestException {
    return new BadRequestException({
      code: 'VALIDATION_ERROR',
      message:
        error instanceof Error ? error.message : 'Invalid project field agent',
    });
  }
}
