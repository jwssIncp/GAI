import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExportJobStatus } from '../../domain/enums/export-job-status.enum';
import { ExportJobType } from '../../domain/enums/export-job-type.enum';
import { ExportJobEntity } from '../../infrastructure/persistence/export-job.entity';

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

export class ExportJobResponseDto {
  @ApiProperty({ type: 'integer', format: 'int64' })
  id!: number;

  @ApiProperty({ type: 'integer', format: 'int64' })
  organization_id!: number;

  @ApiProperty({ type: 'integer', format: 'int64' })
  project_id!: number;

  @ApiProperty({ enum: ExportJobType })
  type!: ExportJobType;

  @ApiProperty({ enum: ExportJobStatus })
  status!: ExportJobStatus;

  @ApiPropertyOptional({ nullable: true })
  file_name!: string | null;

  @ApiPropertyOptional({ nullable: true })
  mime_type!: string | null;

  @ApiPropertyOptional({ type: 'integer', format: 'int64', nullable: true })
  size_bytes!: number | null;

  @ApiPropertyOptional({ nullable: true })
  checksum!: string | null;

  @ApiPropertyOptional({ type: 'integer', format: 'int64', nullable: true })
  requested_by_id!: number | null;

  @ApiPropertyOptional({ type: 'integer', format: 'int64', nullable: true })
  retry_of_id!: number | null;

  @ApiProperty({ type: 'integer', minimum: 1 })
  attempt_count!: number;

  @ApiProperty({ format: 'date-time' })
  requested_at!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  started_at!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  finished_at!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  expires_at!: string | null;

  @ApiPropertyOptional({ nullable: true })
  error_code!: string | null;

  @ApiPropertyOptional({ nullable: true })
  error_message!: string | null;

  @ApiProperty({ format: 'date-time' })
  created_at!: string;

  @ApiProperty({ format: 'date-time' })
  updated_at!: string;

  static fromEntity(entity: ExportJobEntity): ExportJobResponseDto {
    return {
      id: Number(entity.id),
      organization_id: Number(entity.organizationId),
      project_id: Number(entity.projectId),
      type: entity.type,
      status: entity.status,
      file_name: entity.fileName,
      mime_type: entity.mimeType,
      size_bytes: entity.sizeBytes === null ? null : Number(entity.sizeBytes),
      checksum: entity.checksum,
      requested_by_id:
        entity.requestedById === null ? null : Number(entity.requestedById),
      retry_of_id: entity.retryOfId === null ? null : Number(entity.retryOfId),
      attempt_count: Number(entity.attemptCount),
      requested_at: iso(entity.requestedAt)!,
      started_at: iso(entity.startedAt),
      finished_at: iso(entity.finishedAt),
      expires_at: iso(entity.expiresAt),
      error_code: entity.errorCode,
      error_message: entity.errorMessage,
      created_at: iso(entity.createdAt)!,
      updated_at: iso(entity.updatedAt)!,
    };
  }
}

export class ExportJobListResponseDto {
  @ApiProperty({ type: [ExportJobResponseDto] })
  items!: ExportJobResponseDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty({ name: 'page_size' })
  page_size!: number;

  @ApiProperty({ name: 'total_items' })
  total_items!: number;

  @ApiProperty({ name: 'total_pages' })
  total_pages!: number;
}

export class ExportJobDownloadUrlResponseDto {
  @ApiProperty({ type: ExportJobResponseDto })
  job!: ExportJobResponseDto;

  @ApiProperty({
    description:
      'Authenticated API path. The caller must send its bearer token.',
  })
  download_url!: string;

  @ApiProperty({ type: 'integer', minimum: 0 })
  expires_in_seconds!: number;

  @ApiProperty({ default: true })
  requires_authentication!: true;
}
