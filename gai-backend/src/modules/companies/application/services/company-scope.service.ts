import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '../../../auth/domain/enums/user.enums';

export interface CompanyActorContext {
  id: number;
  systemRoles: UserRole[];
  organizationId: number | null;
}

@Injectable()
export class CompanyScopeService {
  resolveOrganizationForCreate(
    actor: CompanyActorContext,
    requestedOrganizationId: number,
  ): number {
    if (actor.systemRoles.includes(UserRole.PLATFORM_ADMIN)) {
      return requestedOrganizationId;
    }
    if (actor.organizationId === null) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    }
    if (actor.organizationId === requestedOrganizationId) {
      return requestedOrganizationId;
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
