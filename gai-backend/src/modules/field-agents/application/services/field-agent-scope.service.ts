import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '../../../auth/domain/enums/user.enums';
import { assertOperationalActor } from './operational-eligibility';

export interface FieldAgentActorContext {
  id: number;
  systemRoles: UserRole[];
  organizationId: number | null;
}

@Injectable()
export class FieldAgentScopeService {
  resolveOrganizationForCreate(actor: FieldAgentActorContext): number {
    assertOperationalActor(actor);
    if (actor.organizationId === null) {
      throw this.forbidden();
    }
    return actor.organizationId;
  }

  resolveOrganizationFilter(
    actor: FieldAgentActorContext,
    requestedOrganizationId?: number,
  ): number | undefined {
    assertOperationalActor(actor);
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
    assertOperationalActor(actor);
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
