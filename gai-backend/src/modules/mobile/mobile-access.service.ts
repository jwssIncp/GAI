import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { AuthenticatedUser } from '../auth/presentation/guards/session-auth.guard';
import { resolveFieldAccess } from '../field-agents/application/services/field-access';
import { FieldAgentEntity } from '../field-agents/infrastructure/persistence/field-agent.entity';
import { ProjectStatusTransitionPolicy } from '../projects/domain/services/project-status-transition.policy';
import { ProjectEntity } from '../projects/infrastructure/persistence/project.entity';

export interface MobileProjectAccess {
  agent: FieldAgentEntity;
  project: ProjectEntity;
  organizationId: number;
}

/**
 * Mobile operations are field operations: the account must be linked to an
 * active field agent with an active, in-period assignment to the project of the
 * session's organization. Ids sent by the app are never proof of authorization.
 */
@Injectable()
export class MobileAccessService {
  constructor(private readonly db: DataSource) {}

  async assertProject(
    actor: AuthenticatedUser,
    projectId: number,
    mutate: boolean,
  ): Promise<MobileProjectAccess> {
    const access = await resolveFieldAccess(
      this.db,
      actor.id,
      actor.organizationId,
    );
    if (!access.eligible || !access.agent || !actor.organizationId)
      throw new ForbiddenException({
        code: 'MOBILE_ACCESS_DENIED',
        message: 'Esta conta não possui acesso operacional ao aplicativo.',
      });
    const project = access.assignments.some((a) => a.projectId === projectId)
      ? await this.db.getRepository(ProjectEntity).findOneBy({
          id: projectId,
          organizationId: actor.organizationId,
        })
      : null;
    if (!project)
      throw new ForbiddenException({
        code: 'PROJECT_NOT_AUTHORIZED',
        message: 'Projeto sem vínculo vigente para este inventariante.',
      });
    if (
      mutate &&
      !ProjectStatusTransitionPolicy.allowsOperationalMutation(project.status)
    )
      throw new ConflictException({
        code: 'PROJECT_STATUS_BLOCKS_OPERATION',
        message: 'O projeto não permite novas operações.',
      });
    return {
      agent: access.agent,
      project,
      organizationId: actor.organizationId,
    };
  }
}
