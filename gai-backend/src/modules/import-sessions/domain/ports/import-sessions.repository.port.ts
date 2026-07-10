import { ImportOperation } from '../enums/import-operation.enum';
import { ImportFileEntity } from '../../infrastructure/persistence/import-file.entity';
import { ImportPayloadEntity } from '../../infrastructure/persistence/import-payload.entity';
import { ImportPayloadErrorEntity } from '../../infrastructure/persistence/import-payload-error.entity';
import { ImportSessionEntity } from '../../infrastructure/persistence/import-session.entity';

export interface ListImportSessionsParams {
  page: number;
  pageSize: number;
  organizationId: number;
  projectId: number;
  status?: string;
}

export interface ListImportPayloadsParams {
  page: number;
  pageSize: number;
  organizationId: number;
  importSessionId: number;
}

export interface ListImportErrorsParams {
  page: number;
  pageSize: number;
  organizationId: number;
  importSessionId: number;
  importPayloadId?: number;
}

export interface ImportAuditEntry {
  organizationId: number;
  projectId: number;
  importSessionId?: number | null;
  importPayloadId?: number | null;
  importFileId?: number | null;
  operation: ImportOperation;
  performedBy: number | null;
  changes: Record<string, unknown>;
}

export const IMPORT_SESSIONS_REPOSITORY = Symbol('IMPORT_SESSIONS_REPOSITORY');

export interface ImportSessionsRepository {
  findSessionById(id: number): Promise<ImportSessionEntity | null>;
  findSessionByUuid(uuid: string): Promise<ImportSessionEntity | null>;
  listSessions(
    params: ListImportSessionsParams,
  ): Promise<{ items: ImportSessionEntity[]; total: number }>;
  saveSession(
    session: ImportSessionEntity,
    audit: ImportAuditEntry,
  ): Promise<ImportSessionEntity>;
  findPayloadById(id: number): Promise<ImportPayloadEntity | null>;
  findPayloadByNumber(
    sessionId: number,
    payloadNumber: number,
  ): Promise<ImportPayloadEntity | null>;
  findPayloadByIdempotencyKey(
    sessionId: number,
    idempotencyKey: string,
  ): Promise<ImportPayloadEntity | null>;
  listPayloads(
    params: ListImportPayloadsParams,
  ): Promise<{ items: ImportPayloadEntity[]; total: number }>;
  savePayloadWithAudit(
    payload: ImportPayloadEntity,
    audit: ImportAuditEntry,
  ): Promise<ImportPayloadEntity>;
  listErrors(
    params: ListImportErrorsParams,
  ): Promise<{ items: ImportPayloadErrorEntity[]; total: number }>;
  findFileById(id: number): Promise<ImportFileEntity | null>;
  listFiles(
    sessionId: number,
    organizationId: number,
  ): Promise<ImportFileEntity[]>;
  saveFileWithAudit(
    file: ImportFileEntity,
    audit: ImportAuditEntry,
  ): Promise<ImportFileEntity>;
  audit(audit: ImportAuditEntry): Promise<void>;
}
