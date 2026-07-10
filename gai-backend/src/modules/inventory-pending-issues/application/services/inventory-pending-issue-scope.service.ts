import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '../../../auth/domain/enums/user.enums';
import { Project } from '../../../projects/domain/entities/project';

export interface InventoryPendingIssueActorContext {
  id: number;
  systemRoles: UserRole[];
  organizationId: number | null;
}

@Injectable()
export class InventoryPendingIssueScopeService {
  assertCanAccessOrganization(
    actor: InventoryPendingIssueActorContext,
    organizationId: number,
  ): void {
    if (actor.systemRoles.includes(UserRole.PLATFORM_ADMIN)) return;
    if (actor.organizationId === organizationId) return;
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Insufficient permissions',
    });
  }

  assertProjectAllowsMutation(project: Project): void {
    if (project.blocksOperationalMutation()) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Project status blocks this operation',
      });
    }
  }

  normalizePlate(value: string | null | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const normalized = value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    return normalized.length === 0 ? null : normalized;
  }

  cleanText(value: string | null | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
}
