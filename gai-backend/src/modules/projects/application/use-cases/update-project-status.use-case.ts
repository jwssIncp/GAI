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
} from '../../domain/ports/project.repository.port';
import {
  ProjectStatusAction,
  ProjectStatusTransitionPolicy,
} from '../../domain/services/project-status-transition.policy';
import { ProjectResponseDto } from '../dto/project-response.dto';
import {
  ProjectActorContext,
  ProjectScopeService,
} from '../services/project-scope.service';

@Injectable()
export class UpdateProjectStatusUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly repository: ProjectRepository,
    private readonly scope: ProjectScopeService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UpdateProjectStatusUseCase.name);
  }

  async execute(
    id: number,
    action: ProjectStatusAction,
    actor: ProjectActorContext,
  ): Promise<ProjectResponseDto> {
    const project = await this.repository.findById(id);
    if (!project) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Project not found',
      });
    }
    this.scope.assertCanAccessProject(actor, project.organizationId);

    const result = await this.repository.transitionStatusWithAudit({
      id,
      action,
      actorId: actor.id,
      now: new Date(),
    });

    if (result.kind === 'not_found') {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Project not found',
      });
    }
    if (
      result.kind === 'invalid_transition' ||
      result.kind === 'concurrent_modification'
    ) {
      throw new ConflictException({
        code: 'PROJECT_STATUS_TRANSITION_NOT_ALLOWED',
        message:
          'O projeto não pode executar esta transição a partir do status atual.',
        details: {
          current_status: result.currentStatus,
          requested_action: action,
        },
      });
    }
    if (result.kind === 'open_operations') {
      throw new ConflictException({
        code: 'PROJECT_HAS_OPEN_OPERATIONS',
        message:
          'O projeto possui operações em andamento e não pode executar esta transição.',
        details: {
          current_status: result.currentStatus,
          requested_action: action,
          operations: result.operations,
        },
      });
    }

    const saved = result.project;
    const rule = ProjectStatusTransitionPolicy.getRule(action);

    this.logger.info({
      operation: `PROJECT_${rule.auditOperation}`,
      projectId: saved.id,
      organizationId: saved.organizationId,
      result: 'SUCCESS',
    });

    return ProjectResponseDto.fromDomain(saved);
  }
}
