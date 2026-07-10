import { AuthAuditOperation, AuthAuditResult } from '../enums/auth-audit.enums';

export interface AuthAuditEntry {
  userId: number | null;
  operation: AuthAuditOperation;
  ipAddress: string | null;
  result: AuthAuditResult;
  metadata?: Record<string, unknown> | null;
}

export const AUTH_AUDIT_REPOSITORY = Symbol('AUTH_AUDIT_REPOSITORY');

export interface AuthAuditRepository {
  save(entry: AuthAuditEntry): Promise<void>;
}
