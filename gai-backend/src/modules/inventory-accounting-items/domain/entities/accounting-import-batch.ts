import { AccountingImportBatchStatus } from '../enums/accounting-import-batch-status.enum';
import { JsonRecord } from './inventory-accounting-item';

export interface ImportErrorRecord {
  row: number;
  errors: string[];
}

export interface AccountingImportBatchProps {
  id: number;
  organizationId: number;
  projectId: number;
  originalFileName: string;
  storageProvider: string | null;
  bucket: string | null;
  path: string | null;
  status: AccountingImportBatchStatus;
  totalRows: number;
  processedRows: number;
  successRows: number;
  failedRows: number;
  errorReportPath: string | null;
  importedById: number | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  metadata: JsonRecord | null;
  createdAt: Date;
  updatedAt: Date;
}

export class AccountingImportBatch {
  constructor(private readonly props: AccountingImportBatchProps) {}

  get id(): number {
    return this.props.id;
  }

  get organizationId(): number {
    return this.props.organizationId;
  }

  get projectId(): number {
    return this.props.projectId;
  }

  fail(errors: ImportErrorRecord[], now: Date): void {
    this.props.status = AccountingImportBatchStatus.FAILED;
    this.props.finishedAt = now;
    this.props.failedRows = errors.length;
    this.props.errorReportPath =
      errors.length > 0 ? 'inline:metadata.error_report' : null;
    this.props.metadata = {
      ...(this.props.metadata ?? {}),
      error_report: errors,
    };
  }

  finish(
    totalRows: number,
    successRows: number,
    errors: ImportErrorRecord[],
    now: Date,
  ): void {
    this.props.status =
      errors.length > 0
        ? AccountingImportBatchStatus.FAILED
        : AccountingImportBatchStatus.FINISHED;
    this.props.totalRows = totalRows;
    this.props.processedRows = totalRows;
    this.props.successRows = successRows;
    this.props.failedRows = errors.length;
    this.props.finishedAt = now;
    this.props.errorReportPath =
      errors.length > 0 ? 'inline:metadata.error_report' : null;
    this.props.metadata = {
      ...(this.props.metadata ?? {}),
      error_report: errors,
    };
  }

  toProps(): AccountingImportBatchProps {
    return { ...this.props };
  }
}
