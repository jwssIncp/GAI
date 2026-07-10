import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '../../../auth/domain/enums/user.enums';
import { Project } from '../../../projects/domain/entities/project';

export interface PaymentsExpensesActorContext {
  id: number;
  systemRoles: UserRole[];
  organizationId: number | null;
}

@Injectable()
export class PaymentsExpensesScopeService {
  assertCanAccessOrganization(
    actor: PaymentsExpensesActorContext,
    organizationId: number,
  ): void {
    if (
      actor.systemRoles.includes(UserRole.PLATFORM_ADMIN) ||
      actor.organizationId === organizationId
    )
      return;
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Insufficient permissions',
    });
  }
  assertProjectAllowsMutation(project: Project): void {
    if (project.blocksOperationalMutation())
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Project status blocks this operation',
      });
  }
  cleanText(value: string | null | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
  parseDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  nextDateString(value: string | null | undefined): string | undefined {
    const date = this.parseDate(value);
    if (!date) return undefined;
    return new Date(date.getTime() + 86400000).toISOString().slice(0, 10);
  }
  daysBetweenInclusive(start: Date, end: Date): number {
    return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  }
  storageProvider(): string {
    return process.env.STORAGE_PROVIDER ?? 's3';
  }
  storageBucket(): string {
    return process.env.STORAGE_BUCKET ?? 'gai-local';
  }
  presignedUrlTtlSeconds(): number {
    return Number(process.env.STORAGE_PRESIGNED_URL_TTL_SECONDS ?? 300);
  }
  buildExpenseAttachmentPath(input: {
    organizationId: number;
    expenseId: number;
    storageKey: string;
    originalName: string;
  }): string {
    const safeName = input.originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `organizations/${input.organizationId}/expenses/${input.expenseId}/${input.storageKey}-${safeName}`;
  }
}
