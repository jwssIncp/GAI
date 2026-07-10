import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '../../../auth/domain/enums/user.enums';
import { ManagedUser } from '../../domain/entities/managed-user';
import {
  isOrganizationSystemRole,
  isRoleCompatibleWithUserOrganization,
  type RoleScopeDescriptor,
} from '../../domain/services/role-assignment-scope';

export interface ActorContext {
  id: number;
  systemRoles: UserRole[];
  organizationId: number | null;
}

@Injectable()
export class UserScopeService {
  assertCanManageUsers(actor: ActorContext): void {
    if (!this.isAdmin(actor)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    }
  }

  assertCanAssignRoles(actor: ActorContext): void {
    this.assertCanManageUsers(actor);
  }

  assertCanAccessUser(actor: ActorContext, user: ManagedUser): void {
    this.assertCanManageUsers(actor);

    if (actor.systemRoles.includes(UserRole.PLATFORM_ADMIN)) {
      return;
    }

    if (
      actor.organizationId === null ||
      user.organizationId !== actor.organizationId
    ) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    }
  }

  assertCanFilterByOrganization(
    actor: ActorContext,
    organizationId?: number,
  ): number | undefined {
    this.assertCanManageUsers(actor);

    if (actor.systemRoles.includes(UserRole.PLATFORM_ADMIN)) {
      return organizationId;
    }

    if (
      organizationId !== undefined &&
      organizationId !== actor.organizationId
    ) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    }

    if (actor.organizationId === null) {
      throw this.forbidden();
    }

    return actor.organizationId;
  }

  assertCanAccessOrganization(
    actor: ActorContext,
    organizationId: number,
  ): void {
    this.assertCanManageUsers(actor);

    if (actor.systemRoles.includes(UserRole.PLATFORM_ADMIN)) {
      return;
    }

    if (
      actor.organizationId === null ||
      actor.organizationId !== organizationId
    ) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    }
  }

  resolveOrganizationIdForCreate(
    actor: ActorContext,
    dtoOrganizationId: number | undefined,
  ): number | null {
    if (actor.systemRoles.includes(UserRole.PLATFORM_ADMIN)) {
      return dtoOrganizationId ?? null;
    }

    if (actor.systemRoles.includes(UserRole.ORG_ADMIN)) {
      if (actor.organizationId === null) {
        throw this.forbidden();
      }
      return actor.organizationId;
    }

    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Insufficient permissions',
    });
  }

  assertPlatformOnlyAssignment(
    actor: ActorContext,
    organizationId: number | null,
  ): void {
    if (
      organizationId === null &&
      !actor.systemRoles.includes(UserRole.PLATFORM_ADMIN)
    ) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    }
  }

  assertCanChangeUserOrganization(actor: ActorContext): void {
    if (!actor.systemRoles.includes(UserRole.PLATFORM_ADMIN)) {
      throw this.forbidden();
    }
  }

  assertCanAssignRole(
    actor: ActorContext,
    userOrganizationId: number | null,
    role: RoleScopeDescriptor,
  ): void {
    if (!isRoleCompatibleWithUserOrganization(role, userOrganizationId)) {
      throw this.forbidden();
    }

    if (actor.systemRoles.includes(UserRole.PLATFORM_ADMIN)) {
      return;
    }

    if (
      actor.organizationId === null ||
      actor.organizationId !== userOrganizationId
    ) {
      throw this.forbidden();
    }

    const ownsOrganizationRole =
      role.organizationId !== null &&
      role.organizationId === actor.organizationId;
    if (!ownsOrganizationRole && !isOrganizationSystemRole(role)) {
      throw this.forbidden();
    }
  }

  assertCanRevokeRole(
    actor: ActorContext,
    userOrganizationId: number | null,
    role: RoleScopeDescriptor,
  ): void {
    if (actor.systemRoles.includes(UserRole.PLATFORM_ADMIN)) {
      return;
    }

    if (
      actor.organizationId === null ||
      userOrganizationId !== actor.organizationId
    ) {
      throw this.forbidden();
    }

    const ownsOrganizationRole =
      role.organizationId !== null &&
      role.organizationId === actor.organizationId;
    if (!ownsOrganizationRole && !isOrganizationSystemRole(role)) {
      throw this.forbidden();
    }
  }

  private isAdmin(actor: ActorContext): boolean {
    return (
      actor.systemRoles.includes(UserRole.PLATFORM_ADMIN) ||
      actor.systemRoles.includes(UserRole.ORG_ADMIN)
    );
  }

  private forbidden(): ForbiddenException {
    return new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Insufficient permissions',
    });
  }
}
