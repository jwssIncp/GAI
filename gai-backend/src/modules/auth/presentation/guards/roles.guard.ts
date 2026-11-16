import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../domain/enums/user.enums';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedUser } from './session-auth.guard';

interface AuthenticatedRequest {
  user?: AuthenticatedUser;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (user && requiredRoles.some((role) => user.systemRoles.includes(role)))
      return true;

    // Mesmo corpo do PermissionsGuard, em vez do 403 padrão do Nest (em inglês).
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Você não tem permissão para esta ação.',
    });
  }
}
