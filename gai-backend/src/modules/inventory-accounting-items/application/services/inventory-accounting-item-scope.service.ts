import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '../../../auth/domain/enums/user.enums';
import { Project } from '../../../projects/domain/entities/project';

export interface InventoryAccountingItemActorContext {
  id: number;
  systemRoles: UserRole[];
  organizationId: number | null;
}

@Injectable()
export class InventoryAccountingItemScopeService {
  assertCanAccessOrganization(
    actor: InventoryAccountingItemActorContext,
    organizationId: number,
  ): void {
    if (actor.systemRoles.includes(UserRole.PLATFORM_ADMIN)) {
      return;
    }
    if (actor.organizationId === organizationId) {
      return;
    }
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

  normalizePlate(value: unknown): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const normalized = this.toScalarString(value)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    return normalized.length === 0 ? null : normalized;
  }

  cleanText(value: unknown): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = this.toScalarString(value).trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  parseDate(value: unknown): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    if (value instanceof Date) {
      return Number.isNaN(value.getTime())
        ? null
        : new Date(
            Date.UTC(
              value.getUTCFullYear(),
              value.getUTCMonth(),
              value.getUTCDate(),
            ),
          );
    }
    if (typeof value === 'number') {
      const epoch = Date.UTC(1899, 11, 30);
      return new Date(epoch + value * 24 * 60 * 60 * 1000);
    }
    const match = this.toScalarString(value)
      .trim()
      .match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return null;
    }
    const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
    return Number(date.getUTCFullYear()) === Number(match[1]) &&
      date.getUTCMonth() + 1 === Number(match[2]) &&
      date.getUTCDate() === Number(match[3])
      ? date
      : null;
  }

  normalizeMoney(value: unknown): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const raw = this.toScalarString(value).trim();
    const text = raw.includes(',')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw;
    if (!/^\d{1,13}(\.\d{1,2})?$/.test(text)) {
      return text;
    }
    return Number(text).toFixed(2);
  }

  private toScalarString(value: unknown): string {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return String(value);
    }
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
    return '';
  }
}
