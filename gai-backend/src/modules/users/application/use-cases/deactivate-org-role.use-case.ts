import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { OrgRoleAuditOperation } from '../../domain/enums/org-role-audit-operation.enum';
import {
  ORG_ROLE_REPOSITORY,
  type OrgRoleRepository,
} from '../../domain/ports/org-role.repository.port';
import { ActorContext, UserScopeService } from '../services/user-scope.service';

@Injectable()
export class DeactivateOrgRoleUseCase {
  constructor(
    @Inject(ORG_ROLE_REPOSITORY)
    private readonly repository: OrgRoleRepository,
    private readonly scope: UserScopeService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(DeactivateOrgRoleUseCase.name);
  }

  async execute(
    organizationId: number,
    roleId: number,
    actor: ActorContext,
  ): Promise<void> {
    this.scope.assertCanAccessOrganization(actor, organizationId);

    const role = await this.repository.findByIdAndOrganization(
      roleId,
      organizationId,
    );
    if (!role) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Org role not found',
      });
    }

    if (!role.isActive) {
      return;
    }

    const activeUsers = await this.repository.countActiveUsersWithRole(roleId);
    if (activeUsers > 0) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Org role is assigned to active users',
      });
    }

    const previousActive = role.isActive;
    role.deactivate();

    await this.repository.saveWithAudit(
      role,
      role.permissions.map((permission) => permission.id),
      {
        orgRoleId: role.id,
        operation: OrgRoleAuditOperation.DEACTIVATE,
        performedBy: actor.id,
        changes: {
          is_active: { before: previousActive, after: false },
        },
      },
    );

    this.logger.info({
      operation: 'DEACTIVATE_ORG_ROLE',
      orgRoleId: role.id,
      organizationId,
      result: 'SUCCESS',
    });
  }
}
