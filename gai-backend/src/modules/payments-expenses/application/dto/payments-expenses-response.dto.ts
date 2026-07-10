import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExpenseAttachment } from '../../domain/entities/expense-attachment';
import { Expense } from '../../domain/entities/expense';
import {
  FieldAgentPayment,
  JsonRecord,
} from '../../domain/entities/field-agent-payment';
import { ExpenseAttachmentStatus } from '../../domain/enums/expense-attachment-status.enum';
import { ExpenseStatus } from '../../domain/enums/expense-status.enum';
import { PaymentStatus } from '../../domain/enums/payment-status.enum';

export class PaymentResponseDto {
  @ApiProperty() id!: number;
  @ApiProperty() organization_id!: number;
  @ApiProperty() project_id!: number;
  @ApiProperty() field_agent_id!: number;
  @ApiPropertyOptional({ nullable: true }) state!: string | null;
  @ApiProperty() start_date!: string;
  @ApiProperty() end_date!: string;
  @ApiPropertyOptional({ nullable: true }) payment_date!: string | null;
  @ApiProperty() days!: number;
  @ApiProperty() daily_rate!: string;
  @ApiProperty() additional_amount!: string;
  @ApiProperty() daily_total!: string;
  @ApiProperty() discount_amount!: string;
  @ApiProperty() final_amount!: string;
  @ApiProperty({ enum: PaymentStatus }) status!: PaymentStatus;
  @ApiPropertyOptional({ nullable: true }) notes!: string | null;
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  metadata!: JsonRecord | null;
  @ApiProperty() created_at!: string;
  @ApiProperty() updated_at!: string;
  static fromDomain(p: FieldAgentPayment): PaymentResponseDto {
    const x = p.toProps();
    return {
      id: x.id,
      organization_id: x.organizationId,
      project_id: x.projectId,
      field_agent_id: x.fieldAgentId,
      state: x.state,
      start_date: x.startDate.toISOString().slice(0, 10),
      end_date: x.endDate.toISOString().slice(0, 10),
      payment_date: x.paymentDate?.toISOString().slice(0, 10) ?? null,
      days: x.days,
      daily_rate: x.dailyRate,
      additional_amount: x.additionalAmount,
      daily_total: x.dailyTotal,
      discount_amount: x.discountAmount,
      final_amount: x.finalAmount,
      status: x.status,
      notes: x.notes,
      metadata: x.metadata,
      created_at: x.createdAt.toISOString(),
      updated_at: x.updatedAt.toISOString(),
    };
  }
}
export class PaymentListResponseDto {
  @ApiProperty({ type: [PaymentResponseDto] }) items!: PaymentResponseDto[];
  @ApiProperty() page!: number;
  @ApiProperty() page_size!: number;
  @ApiProperty() total_items!: number;
  @ApiProperty() total_pages!: number;
}
export class PaymentSummaryResponseDto {
  @ApiProperty() total_pending!: string;
  @ApiProperty() total_approved!: string;
  @ApiProperty() total_paid!: string;
  @ApiProperty() total_cancelled!: string;
  @ApiProperty() total_count!: number;
}

export class ExpenseResponseDto {
  @ApiProperty() id!: number;
  @ApiProperty() organization_id!: number;
  @ApiProperty() project_id!: number;
  @ApiPropertyOptional({ nullable: true }) field_agent_id!: number | null;
  @ApiProperty() description!: string;
  @ApiPropertyOptional({ nullable: true }) reason!: string | null;
  @ApiProperty() expense_date!: string;
  @ApiProperty() amount!: string;
  @ApiProperty({ enum: ExpenseStatus }) status!: ExpenseStatus;
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  metadata!: JsonRecord | null;
  @ApiProperty() created_at!: string;
  @ApiProperty() updated_at!: string;
  static fromDomain(e: Expense): ExpenseResponseDto {
    const x = e.toProps();
    return {
      id: x.id,
      organization_id: x.organizationId,
      project_id: x.projectId,
      field_agent_id: x.fieldAgentId,
      description: x.description,
      reason: x.reason,
      expense_date: x.expenseDate.toISOString().slice(0, 10),
      amount: x.amount,
      status: x.status,
      metadata: x.metadata,
      created_at: x.createdAt.toISOString(),
      updated_at: x.updatedAt.toISOString(),
    };
  }
}
export class ExpenseListResponseDto {
  @ApiProperty({ type: [ExpenseResponseDto] }) items!: ExpenseResponseDto[];
  @ApiProperty() page!: number;
  @ApiProperty() page_size!: number;
  @ApiProperty() total_items!: number;
  @ApiProperty() total_pages!: number;
}

export class ExpenseAttachmentResponseDto {
  @ApiProperty() id!: number;
  @ApiProperty() organization_id!: number;
  @ApiProperty() expense_id!: number;
  @ApiProperty() original_name!: string;
  @ApiProperty() mime_type!: string;
  @ApiProperty() size_bytes!: number;
  @ApiPropertyOptional({ nullable: true }) checksum!: string | null;
  @ApiProperty({ enum: ExpenseAttachmentStatus })
  status!: ExpenseAttachmentStatus;
  @ApiProperty() created_at!: string;
  static fromDomain(a: ExpenseAttachment): ExpenseAttachmentResponseDto {
    const x = a.toProps();
    return {
      id: x.id,
      organization_id: x.organizationId,
      expense_id: x.expenseId,
      original_name: x.originalName,
      mime_type: x.mimeType,
      size_bytes: x.sizeBytes,
      checksum: x.checksum,
      status: x.status,
      created_at: x.createdAt.toISOString(),
    };
  }
}
export class AttachmentUploadUrlResponseDto {
  @ApiProperty({ type: ExpenseAttachmentResponseDto })
  attachment!: ExpenseAttachmentResponseDto;
  @ApiProperty() upload_url!: string;
  @ApiProperty() expires_in_seconds!: number;
}
export class AttachmentDownloadUrlResponseDto {
  @ApiProperty({ type: ExpenseAttachmentResponseDto })
  attachment!: ExpenseAttachmentResponseDto;
  @ApiProperty() download_url!: string;
  @ApiProperty() expires_in_seconds!: number;
}
