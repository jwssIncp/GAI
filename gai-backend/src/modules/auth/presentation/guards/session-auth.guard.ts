import {
  CanActivate,
  ForbiddenException,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
  Optional,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FieldAgentEntity } from '../../../field-agents/infrastructure/persistence/field-agent.entity';
import { operationalDay } from '../../../field-agents/application/services/operational-eligibility';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { RoleAuthorizationService } from '../../application/services/role-authorization.service';
import { UserRole } from '../../domain/enums/user.enums';
import {
  ORGANIZATION_GATE,
  type OrganizationGate,
} from '../../domain/ports/organization-gate.port';
import {
  PERMISSION_RESOLVER,
  type PermissionResolver,
} from '../../domain/ports/permission-resolver.port';
import {
  SESSION_REPOSITORY,
  type SessionRepository,
} from '../../domain/ports/session.repository.port';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../domain/ports/user.repository.port';
import { PermissionScope } from '../../../users/domain/enums/permission-scope.enum';
import {
  USER_ROLE_ASSIGNMENT_REPOSITORY,
  type AssignedRole,
  type UserRoleAssignmentRepository,
} from '../../../users/domain/ports/user-role-assignment.repository.port';

export interface AuthenticatedUser {
  allowedProjectIds?: number[];
  id: number;
  systemRoles: UserRole[];
  primaryRole: UserRole | null;
  organizationId: number | null;
  sessionId: string;
  roleAssignments: AssignedRole[];
  permissions: Array<{ key: string; scope: PermissionScope }>;
}

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    @Inject(SESSION_REPOSITORY)
    private readonly sessions: SessionRepository,
    @Inject(USER_REPOSITORY)
    private readonly users: UserRepository,
    @Inject(PERMISSION_RESOLVER)
    private readonly permissionResolver: PermissionResolver,
    @Inject(USER_ROLE_ASSIGNMENT_REPOSITORY)
    private readonly assignments: UserRoleAssignmentRepository,
    private readonly roleAuth: RoleAuthorizationService,
    private readonly configService: ConfigService,
    @Inject(ORGANIZATION_GATE)
    private readonly organizationGate: OrganizationGate,
    @Optional() private readonly db?: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const now = new Date();
    const session = await this.sessions.findActiveById(token, now);
    if (!session) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired session',
      });
    }

    const user = await this.users.findById(session.userId);
    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired session',
      });
    }

    if (
      (session.authVersion ?? 0) !== (user.authVersion ?? 0) ||
      !user.canLogin(now)
    ) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired session',
      });
    }

    if (
      user.organizationId !== null &&
      !(await this.organizationGate.isActive(user.organizationId))
    ) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired session',
      });
    }

    if (
      user.mustChangePassword &&
      user.temporaryPasswordExpiresAt &&
      user.temporaryPasswordExpiresAt <= now
    ) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message:
          'A senha temporária expirou. Solicite uma nova ao administrador.',
      });
    }
    const endpoint = (request.path || request.url || '').replace(/\/$/, '');
    if (
      user.mustChangePassword &&
      ![
        '/api/v1/auth/me',
        '/api/v1/auth/logout',
        '/api/v1/auth/password/change',
      ].includes(endpoint)
    ) {
      throw new ForbiddenException({
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Altere a senha temporária para continuar.',
      });
    }
    const sessionTtlHours = this.configService.get<number>(
      'auth.sessionTtlHours',
      8,
    );
    const expiresAt = new Date(
      now.getTime() + sessionTtlHours * 60 * 60 * 1000,
    );
    await this.sessions.touch(session.id, now, expiresAt);

    const roleAssignments = await this.assignments.findActiveByUserId(user.id);
    const systemRoles = this.roleAuth.extractSystemRoles(roleAssignments);
    const permissions = await this.permissionResolver.resolveForUser(user.id);
    let allowedProjectIds: number[] | undefined;
    if (
      !systemRoles.includes(UserRole.ORG_ADMIN) &&
      !systemRoles.includes(UserRole.PLATFORM_ADMIN) &&
      roleAssignments.some((role) =>
        role.roleKey?.startsWith('FIELD_AGENT_ORG_'),
      )
    ) {
      if (!this.db)
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'Não foi possível verificar os projetos autorizados.',
        });
      const links = await this.db
        .getRepository(FieldAgentEntity)
        .createQueryBuilder('agent')
        .innerJoin(
          'project_field_agents',
          'link',
          'link.field_agent_id=agent.id AND link.organization_id=agent.organization_id',
        )
        .innerJoin(
          'projects',
          'project',
          'project.id=link.project_id AND project.organization_id=agent.organization_id AND project.deleted_at IS NULL',
        )
        .where(
          'agent.userId=:userId AND agent.organizationId=:org AND agent.status=:active AND link.status=:active',
          { userId: user.id, org: user.organizationId, active: 'active' },
        )
        .andWhere(
          '(link.start_date IS NULL OR link.start_date<=:today) AND (link.end_date IS NULL OR link.end_date>=:today)',
          { today: operationalDay() },
        )
        .select('link.project_id', 'id')
        .getRawMany<{ id: number }>();
      allowedProjectIds = links.map((link) => Number(link.id));
      const projectId = endpoint.match(
        /^\/api\/v1\/projects\/(\d+)(?:\/|$)/,
      )?.[1];
      if (
        !endpoint.startsWith('/api/v1/auth/') &&
        !(endpoint === '/api/v1/projects' && request.method === 'GET') &&
        (!projectId || !allowedProjectIds.includes(Number(projectId)))
      ) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message:
            'Sua conta de campo só acessa projetos com vínculo ativo e vigente.',
        });
      }
    }

    request.user = {
      id: user.id,
      systemRoles,
      primaryRole: this.roleAuth.resolvePrimaryRole(systemRoles),
      organizationId: user.organizationId,
      sessionId: session.id,
      roleAssignments,
      permissions,
      allowedProjectIds,
    };

    return true;
  }

  private extractToken(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.slice(7).trim();
  }
}
