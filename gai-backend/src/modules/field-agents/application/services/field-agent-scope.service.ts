import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '../../../auth/domain/enums/user.enums';

export interface FieldAgentActorContext {
  id: number;
  systemRoles: UserRole[];
  organizationId: number | null;
}

@Injectable()
export class FieldAgentScopeService {
  resolveOrganizationForCreate(
    actor: FieldAgentActorContext,
    requestedOrganizationId: number,
  ): number {
    if (actor.systemRoles.includes(UserRole.PLATFORM_ADMIN)) {
      return requestedOrganizationId;
    }
    if (actor.organizationId === null) {
      throw this.forbidden();
    }
    if (actor.organizationId === requestedOrganizationId) {
      return requestedOrganizationId;
    }
    throw this.forbidden();
  }

  resolveOrganizationFilter(
    actor: FieldAgentActorContext,
    requestedOrganizationId?: number,
  ): number | undefined {
    if (actor.systemRoles.includes(UserRole.PLATFORM_ADMIN)) {
      return requestedOrganizationId;
    }
    if (actor.organizationId === null) {
      throw this.forbidden();
    }
    if (
      requestedOrganizationId !== undefined &&
      requestedOrganizationId !== actor.organizationId
    ) {
      throw this.forbidden();
    }
    return actor.organizationId;
  }

  assertCanAccessOrganization(
    actor: FieldAgentActorContext,
    organizationId: number,
  ): void {
    if (actor.systemRoles.includes(UserRole.PLATFORM_ADMIN)) {
      return;
    }
    if (actor.organizationId !== organizationId) {
      throw this.forbidden();
    }
  }

  private forbidden(): ForbiddenException {
    return new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Insufficient permissions',
    });
  }
}
