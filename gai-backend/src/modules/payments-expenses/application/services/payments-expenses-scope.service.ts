import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '../../../auth/domain/enums/user.enums';
import { Project } from '../../../projects/domain/entities/project';
import { BadRequestException } from '@nestjs/common';
import { isCivilDate } from '../../../../common/validation/civil-date';

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
    if (value === null || value === undefined) return null;
    if (!isCivilDate(value))
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid civil date; use YYYY-MM-DD',
      });
    return new Date(`${value}T00:00:00.000Z`);
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
  /** Receipt-specific limit, independent of the global storage cap (which is
   * raised to 100 MiB for import backups). */
  assertAttachmentSize(sizeBytes: number): void {
    const max = Number(
      process.env.EXPENSE_ATTACHMENT_MAX_SIZE_BYTES ?? 20 * 1024 * 1024,
    );
    if (sizeBytes > max)
      throw new BadRequestException({
        code: 'STORAGE_INVALID_SIZE',
        message: `O comprovante excede o limite de ${max} bytes.`,
      });
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
