import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Project } from '../../domain/entities/project';
import { ProjectAuditOperation } from '../../domain/enums/project-audit-operation.enum';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from '../../domain/ports/project.repository.port';
import { ProjectResponseDto } from '../dto/project-response.dto';
import {
  ProjectActorContext,
  ProjectScopeService,
} from '../services/project-scope.service';

export type ProjectStatusAction =
  | 'deactivate'
  | 'reactivate'
  | 'finish'
  | 'cancel'
  | 'archive';

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

    let changes: Record<string, { before: unknown; after: unknown }>;
    try {
      changes = this.applyAction(project, action, actor.id);
    } catch (error) {
      throw new ConflictException({
        code: 'CONFLICT',
        message:
          error instanceof Error
            ? error.message
            : 'Project status blocks this operation',
      });
    }

    const saved = await this.repository.saveWithAudit(project, {
      projectId: project.id,
      organizationId: project.organizationId,
      operation: this.operationFor(action),
      performedBy: actor.id,
      changes,
    });

    this.logger.info({
      operation: `PROJECT_${this.operationFor(action)}`,
      projectId: saved.id,
      organizationId: saved.organizationId,
      result: 'SUCCESS',
    });

    return ProjectResponseDto.fromDomain(saved);
  }

  private applyAction(
    project: Project,
    action: ProjectStatusAction,
    actorId: number,
  ): Record<string, { before: unknown; after: unknown }> {
    switch (action) {
      case 'deactivate':
        return project.deactivate(actorId);
      case 'reactivate':
        return project.reactivate(actorId);
      case 'finish':
        return project.finish(actorId, new Date());
      case 'cancel':
        return project.cancel(actorId);
      case 'archive':
        return project.archive(actorId);
    }
  }

  private operationFor(action: ProjectStatusAction): ProjectAuditOperation {
    const map: Record<ProjectStatusAction, ProjectAuditOperation> = {
      deactivate: ProjectAuditOperation.DEACTIVATE,
      reactivate: ProjectAuditOperation.REACTIVATE,
      finish: ProjectAuditOperation.FINISH,
      cancel: ProjectAuditOperation.CANCEL,
      archive: ProjectAuditOperation.ARCHIVE,
    };
    return map[action];
  }
}
