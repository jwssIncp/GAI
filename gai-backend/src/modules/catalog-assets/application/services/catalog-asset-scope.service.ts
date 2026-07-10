import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '../../../auth/domain/enums/user.enums';

export interface CatalogAssetActorContext {
  id: number;
  systemRoles: UserRole[];
  organizationId: number | null;
}

@Injectable()
export class CatalogAssetScopeService {
  resolveOrganizationForCreate(
    actor: CatalogAssetActorContext,
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
    actor: CatalogAssetActorContext,
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
    actor: CatalogAssetActorContext,
    organizationId: number,
  ): void {
    if (actor.systemRoles.includes(UserRole.PLATFORM_ADMIN)) {
      return;
    }
    if (actor.organizationId !== organizationId) {
      throw this.forbidden();
    }
  }

  cleanText(value: string | null | undefined): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    const trimmed = value.trim().replace(/\s+/g, ' ');
    return trimmed.length === 0 ? null : trimmed;
  }

  normalizeDescription(value: string): string {
    return value
      .trim()
      .replace(/\s+/g, ' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private forbidden(): ForbiddenException {
    return new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Insufficient permissions',
    });
  }
}
