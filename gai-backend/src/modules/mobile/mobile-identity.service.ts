import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { hasAllPermissions } from '../auth/application/services/permission-access';
import {
  PERMISSION_RESOLVER,
  type PermissionResolver,
} from '../auth/domain/ports/permission-resolver.port';
import { SessionEntity } from '../auth/infrastructure/persistence/session.entity';
import { UserEntity } from '../auth/infrastructure/persistence/user.entity';
import type { AuthenticatedUser } from '../auth/presentation/guards/session-auth.guard';
import { resolveFieldAccess } from '../field-agents/application/services/field-access';
import { FIELD_ACCESS_PERMISSIONS } from '../field-agents/domain/field-access-permissions';
import { OrganizationEntity } from '../organizations/infrastructure/persistence/organization.entity';
import { ProjectStatusTransitionPolicy } from '../projects/domain/services/project-status-transition.policy';
import { ProjectEntity } from '../projects/infrastructure/persistence/project.entity';

/** Operational permissions the app may adapt its UI to (never administrative). */
export const MOBILE_RELEVANT_PERMISSIONS: readonly string[] = [
  ...FIELD_ACCESS_PERMISSIONS,
  'import-sessions:create',
  'import-sessions:read',
  'import-sessions:finish',
  'import-files:create',
  'import-payloads:create',
  'import-errors:read',
  'inventory-pending-issues:read',
  'expenses:create',
  'expenses:upload-attachment',
];

@Injectable()
export class MobileIdentityService {
  constructor(
    private readonly db: DataSource,
    @Inject(PERMISSION_RESOLVER)
    private readonly permissionResolver: PermissionResolver,
  ) {}

  async me(actor: AuthenticatedUser) {
    // Organization and identity come only from the authenticated session.
    const user = await this.db
      .getRepository(UserEntity)
      .findOneByOrFail({ id: actor.id });
    const access = await resolveFieldAccess(
      this.db,
      user.id,
      user.organizationId ?? null,
    );
    if (!access.eligible || !access.agent || !user.organizationId)
      throw new ForbiddenException({
        code: 'MOBILE_ACCESS_DENIED',
        message: 'Esta conta não possui acesso operacional ao aplicativo.',
      });
    const organization = await this.db
      .getRepository(OrganizationEntity)
      .findOneByOrFail({ id: user.organizationId });
    const projectIds = [...new Set(access.assignments.map((a) => a.projectId))];
    const projects = projectIds.length
      ? await this.db.getRepository(ProjectEntity).find({
          where: { id: In(projectIds), organizationId: user.organizationId },
          order: { name: 'ASC' },
        })
      : [];
    const session = await this.db
      .getRepository(SessionEntity)
      .findOneByOrFail({ id: actor.sessionId });
    const granted = await Promise.all(
      MOBILE_RELEVANT_PERMISSIONS.map(async (key) =>
        (await hasAllPermissions(actor, [key], this.permissionResolver))
          ? key
          : null,
      ),
    );
    return {
      user: {
        id: user.id,
        full_name: user.fullName ?? null,
        login: user.login,
        email: user.email,
        must_change_password: user.mustChangePassword,
      },
      organization: {
        id: organization.id,
        name: organization.tradeName || organization.legalName,
      },
      field_agent: {
        id: access.agent.id,
        name: access.agent.name,
        status: access.agent.status,
      },
      projects: projects
        .filter((project) =>
          ProjectStatusTransitionPolicy.allowsOperationalMutation(
            project.status,
          ),
        )
        .map((project) => {
          const link = access.assignments.find(
            (a) => a.projectId === project.id,
          )!;
          return {
            id: project.id,
            name: project.name,
            code: project.code ?? null,
            status: project.status,
            assignment: {
              id: link.assignmentId,
              role: link.role,
              start_date: link.startDate,
              end_date: link.endDate,
            },
          };
        }),
      permissions: granted.filter((key): key is string => key !== null),
      session: {
        client_type: session.clientType,
        expires_at: session.expiresAt.toISOString(),
      },
    };
  }
}
