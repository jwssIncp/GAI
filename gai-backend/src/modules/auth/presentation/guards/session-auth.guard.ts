import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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

    if (!user.canLogin(now)) {
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

    request.user = {
      id: user.id,
      systemRoles,
      primaryRole: this.roleAuth.resolvePrimaryRole(systemRoles),
      organizationId: user.organizationId,
      sessionId: session.id,
      roleAssignments,
      permissions,
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
