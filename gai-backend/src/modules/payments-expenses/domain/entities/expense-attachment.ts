import { ExpenseAttachmentStatus } from '../enums/expense-attachment-status.enum';

export interface ExpenseAttachmentProps {
  id: number;
  organizationId: number;
  expenseId: number;
  storageProvider: string;
  bucket: string;
  path: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string | null;
  status: ExpenseAttachmentStatus;
  uploadedById: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class ExpenseAttachment {
  constructor(private readonly props: ExpenseAttachmentProps) {}
  get id(): number {
    return this.props.id;
  }
  get organizationId(): number {
    return this.props.organizationId;
  }
  get expenseId(): number {
    return this.props.expenseId;
  }
  get bucket(): string {
    return this.props.bucket;
  }
  get path(): string {
    return this.props.path;
  }
  get mimeType(): string {
    return this.props.mimeType;
  }
  get status(): ExpenseAttachmentStatus {
    return this.props.status;
  }
  confirmUpload(input: {
    checksum?: string | null;
    sizeBytes?: number | null;
  }): Record<string, { before: unknown; after: unknown }> {
    if (this.props.status !== ExpenseAttachmentStatus.PENDING_UPLOAD)
      throw new Error('Only pending attachments can be confirmed');
    const before = this.props.status;
    this.props.status = ExpenseAttachmentStatus.UPLOADED;
    if (input.checksum !== undefined) this.props.checksum = input.checksum;
    if (input.sizeBytes !== undefined && input.sizeBytes !== null)
      this.props.sizeBytes = input.sizeBytes;
    return { status: { before, after: this.props.status } };
  }
  remove(): Record<string, { before: unknown; after: unknown }> {
    const before = this.props.status;
    this.props.status = ExpenseAttachmentStatus.REMOVED;
    this.props.deletedAt = new Date();
    return {
      status: { before, after: this.props.status },
      deleted_at: { before: null, after: this.props.deletedAt },
    };
  }
  toProps(): ExpenseAttachmentProps {
    return { ...this.props };
  }
}
