import {
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
import { FieldAgentAuditOperation } from '../../domain/enums/field-agent-audit-operation.enum';
import {
  FIELD_AGENT_REPOSITORY,
  type FieldAgentRepository,
} from '../../domain/ports/field-agent.repository.port';
import { ProjectFieldAgentResponseDto } from '../dto/field-agent-response.dto';
import {
  FieldAgentActorContext,
  FieldAgentScopeService,
} from '../services/field-agent-scope.service';
import {
  assertProjectAllowsFieldAgentMutation,
  ProjectStatusBlocksFieldAgentOperationError,
  projectStatusBlocksFieldAgentOperation,
} from '../errors/project-status-blocks-operation';

@Injectable()
export class RemoveProjectFieldAgentUseCase {
  constructor(
    @Inject(FIELD_AGENT_REPOSITORY)
    private readonly repository: FieldAgentRepository,
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepository,
    private readonly scope: FieldAgentScopeService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(RemoveProjectFieldAgentUseCase.name);
  }

  async execute(
    projectId: number,
    assignmentId: number,
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

    const assignment = await this.repository.findAssignmentById(assignmentId);
    if (!assignment || assignment.projectId !== projectId) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Project field agent not found',
      });
    }

    let changes: Record<string, { before: unknown; after: unknown }>;
    try {
      changes = assignment.remove();
    } catch (error) {
      throw new ConflictException({
        code: 'CONFLICT',
        message:
          error instanceof Error
            ? error.message
            : 'Project field agent status blocks this operation',
      });
    }

    let saved;
    try {
      saved = await this.repository.saveAssignmentWithAudit(assignment, {
        organizationId: assignment.organizationId,
        fieldAgentId: assignment.fieldAgentId,
        projectFieldAgentId: assignment.id,
        projectId: assignment.projectId,
        operation: FieldAgentAuditOperation.REMOVE_FROM_PROJECT,
        performedBy: actor.id,
        changes,
      });
    } catch (error) {
      if (error instanceof ProjectStatusBlocksFieldAgentOperationError) {
        throw projectStatusBlocksFieldAgentOperation(error.currentStatus);
      }
      throw error;
    }

    this.logger.info({
      operation: 'REMOVE_PROJECT_FIELD_AGENT',
      projectFieldAgentId: saved.id,
      projectId: saved.projectId,
      organizationId: saved.organizationId,
      result: 'SUCCESS',
    });

    return ProjectFieldAgentResponseDto.fromDomain(saved);
  }
}
