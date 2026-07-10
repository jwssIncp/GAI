import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../domain/enums/user.enums';
import { PermissionScope } from '../../../users/domain/enums/permission-scope.enum';
import {
  PERMISSION_RESOLVER,
  type PermissionResolver,
} from '../../domain/ports/permission-resolver.port';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import type { AuthenticatedUser } from './session-auth.guard';

interface AuthenticatedRequest {
  user?: AuthenticatedUser;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(PERMISSION_RESOLVER)
    private readonly permissionResolver: PermissionResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    }

    if (user.systemRoles.includes(UserRole.PLATFORM_ADMIN)) {
      return true;
    }

    if (user.systemRoles.includes(UserRole.ORG_ADMIN)) {
      const scopes =
        await this.permissionResolver.findScopesByKeys(requiredPermissions);
      const requiresPlatform = requiredPermissions.some(
        (key) => scopes.get(key) === PermissionScope.PLATFORM,
      );
      if (!requiresPlatform) {
        return true;
      }
    }

    const grantedKeys = new Set(
      user.permissions.map((permission) => permission.key),
    );
    const allowed = requiredPermissions.every((key) => grantedKeys.has(key));
    if (!allowed) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    }

    return true;
  }
}
