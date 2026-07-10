import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { UserRole } from '../../domain/enums/user.enums';

import type { AuthenticatedUser } from './session-auth.guard';

interface DevAuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@Injectable()
export class DevAdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.configService.get<string>('app.nodeEnv') === 'production') {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'DevAdminGuard is not available in production',
      });
    }

    const request = context
      .switchToHttp()
      .getRequest<DevAuthenticatedRequest>();
    request.user = {
      id: 0,
      systemRoles: [UserRole.PLATFORM_ADMIN],
      primaryRole: UserRole.PLATFORM_ADMIN,
      organizationId: null,
      sessionId: 'dev-session',
      roleAssignments: [],
      permissions: [],
    };
    return true;
  }
}
