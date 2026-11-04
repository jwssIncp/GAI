import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '../../../auth/domain/enums/user.enums';

export interface CompanyActorContext {
  id: number;
  systemRoles: UserRole[];
  organizationId: number | null;
  permissions?: string[];
}

@Injectable()
export class CompanyScopeService {
  resolveOrganizationForCreate(
    actor: CompanyActorContext,
    requestedOrganizationId?: number,
  ): number {
    if (actor.systemRoles.includes(UserRole.PLATFORM_ADMIN)) {
      if (
        !requestedOrganizationId ||
        !Number.isSafeInteger(requestedOrganizationId) ||
        requestedOrganizationId < 1
      ) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Selecione uma organização válida.',
        });
      }
      return requestedOrganizationId;
    }
    if (actor.organizationId === null) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Nenhuma organização autorizada está associada à sessão.',
      });
    }
    if (
      requestedOrganizationId === undefined ||
      actor.organizationId === requestedOrganizationId
    ) {
      return actor.organizationId;
    }
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Insufficient permissions',
    });
  }

  resolveOrganizationFilter(
    actor: CompanyActorContext,
    requestedOrganizationId?: number,
  ): number | undefined {
    if (actor.systemRoles.includes(UserRole.PLATFORM_ADMIN)) {
      return requestedOrganizationId;
    }
    if (actor.organizationId === null) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    }
    if (
      requestedOrganizationId !== undefined &&
      requestedOrganizationId !== actor.organizationId
    ) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    }
    return actor.organizationId;
  }

  assertCanAccessOrganization(
    actor: CompanyActorContext,
    organizationId: number,
  ): void {
    if (actor.systemRoles.includes(UserRole.PLATFORM_ADMIN)) {
      return;
    }
    if (actor.organizationId !== organizationId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    }
  }
}
