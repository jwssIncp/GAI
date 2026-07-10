import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '../../domain/enums/user.enums';
import type { AuthenticatedUser } from './session-auth.guard';

interface AuthenticatedRequest {
  user?: AuthenticatedUser;
  params?: Record<string, string>;
}

@Injectable()
export class OrganizationScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
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

    const organizationIdParam =
      request.params?.organizationId ?? request.params?.organization_id;
    if (!organizationIdParam) {
      return true;
    }

    const organizationId = Number.parseInt(organizationIdParam, 10);
    if (user.organizationId !== organizationId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    }

    return true;
  }
}
