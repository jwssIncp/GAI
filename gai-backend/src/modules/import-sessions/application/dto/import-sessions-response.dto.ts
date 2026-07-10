import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JsonRecord } from '../../../projects/domain/entities/project';
import { ImportFileStatus } from '../../domain/enums/import-file-status.enum';
import { ImportFileType } from '../../domain/enums/import-file-type.enum';
import { ImportPayloadStatus } from '../../domain/enums/import-payload-status.enum';
import { ImportSessionSource } from '../../domain/enums/import-session-source.enum';
import { ImportSessionStatus } from '../../domain/enums/import-session-status.enum';
import { ImportSessionType } from '../../domain/enums/import-session-type.enum';
import { ImportFileEntity } from '../../infrastructure/persistence/import-file.entity';
import { ImportPayloadEntity } from '../../infrastructure/persistence/import-payload.entity';
import { ImportPayloadErrorEntity } from '../../infrastructure/persistence/import-payload-error.entity';
import { ImportSessionEntity } from '../../infrastructure/persistence/import-session.entity';

export class ImportSessionResponseDto {
  @ApiProperty()
  id!: number;
  @ApiProperty()
  organization_id!: number;
  @ApiProperty()
  project_id!: number;
  @ApiProperty({ enum: ImportSessionType })
  type!: ImportSessionType;
  @ApiProperty({ enum: ImportSessionSource })
  source!: ImportSessionSource;
  @ApiProperty({ enum: ImportSessionStatus })
  status!: ImportSessionStatus;
  @ApiProperty()
  session_uuid!: string;
  @ApiPropertyOptional()
  expected_payloads!: number | null;
  @ApiProperty()
  received_payloads!: number;
  @ApiProperty()
  processed_payloads!: number;
  @ApiProperty()
  failed_payloads!: number;
  @ApiProperty()
  total_items!: number;
  @ApiProperty()
  total_images!: number;
  @ApiProperty()
  total_created!: number;
  @ApiProperty()
  total_updated!: number;
  @ApiProperty()
  total_deleted!: number;
  @ApiProperty()
  total_failed!: number;
  @ApiPropertyOptional()
  raw_backup_path!: string | null;
  @ApiPropertyOptional()
  error_message!: string | null;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  metadata!: JsonRecord | null;
  @ApiProperty()
  created_at!: Date;
  @ApiProperty()
  updated_at!: Date;

  static fromEntity(entity: ImportSessionEntity): ImportSessionResponseDto {
    return {
      id: Number(entity.id),
      organization_id: Number(entity.organizationId),
      project_id: Number(entity.projectId),
      type: entity.type,
      source: entity.source,
      status: entity.status,
      session_uuid: entity.sessionUuid,
      expected_payloads: entity.expectedPayloads,
      received_payloads: Number(entity.receivedPayloads),
      processed_payloads: Number(entity.processedPayloads),
      failed_payloads: Number(entity.failedPayloads),
      total_items: Number(entity.totalItems),
      total_images: Number(entity.totalImages),
      total_created: Number(entity.totalCreated),
      total_updated: Number(entity.totalUpdated),
      total_deleted: Number(entity.totalDeleted),
      total_failed: Number(entity.totalFailed),
      raw_backup_path: entity.rawBackupPath,
      error_message: entity.errorMessage,
      metadata: entity.metadata,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}

export class ImportPayloadResponseDto {
  @ApiProperty()
  id!: number;
  @ApiProperty()
  payload_number!: number;
  @ApiProperty()
  idempotency_key!: string;
  @ApiPropertyOptional()
  checksum!: string | null;
  @ApiProperty({ enum: ImportPayloadStatus })
  status!: ImportPayloadStatus;
  @ApiProperty()
  items_count!: number;
  @ApiProperty()
  images_count!: number;
  @ApiProperty()
  created_count!: number;
  @ApiProperty()
  updated_count!: number;
  @ApiProperty()
  deleted_count!: number;
  @ApiProperty()
  failed_count!: number;
  @ApiPropertyOptional()
  raw_payload_path!: string | null;
  @ApiPropertyOptional()
  error_message!: string | null;

  static fromEntity(entity: ImportPayloadEntity): ImportPayloadResponseDto {
    return {
      id: Number(entity.id),
      payload_number: Number(entity.payloadNumber),
      idempotency_key: entity.idempotencyKey,
      checksum: entity.checksum,
      status: entity.status,
      items_count: Number(entity.itemsCount),
      images_count: Number(entity.imagesCount),
      created_count: Number(entity.createdCount),
      updated_count: Number(entity.updatedCount),
      deleted_count: Number(entity.deletedCount),
      failed_count: Number(entity.failedCount),
      raw_payload_path: entity.rawPayloadPath,
      error_message: entity.errorMessage,
    };
  }
}

export class ImportPayloadErrorResponseDto {
  @ApiProperty()
  id!: number;
  @ApiPropertyOptional()
  row_number!: number | null;
  @ApiPropertyOptional()
  item_reference!: string | null;
  @ApiProperty()
  error_code!: string;
  @ApiProperty()
  error_message!: string;
  @ApiProperty()
  created_at!: Date;

  static fromEntity(
    entity: ImportPayloadErrorEntity,
  ): ImportPayloadErrorResponseDto {
    return {
      id: Number(entity.id),
      row_number: entity.rowNumber,
      item_reference: entity.itemReference,
      error_code: entity.errorCode,
      error_message: entity.errorMessage,
      created_at: entity.createdAt,
    };
  }
}

export class ImportFileResponseDto {
  @ApiProperty()
  id!: number;
  @ApiProperty({ enum: ImportFileType })
  type!: ImportFileType;
  @ApiProperty()
  storage_provider!: string;
  @ApiProperty()
  bucket!: string;
  @ApiProperty()
  path!: string;
  @ApiProperty()
  original_name!: string;
  @ApiProperty()
  mime_type!: string;
  @ApiProperty()
  size_bytes!: number;
  @ApiPropertyOptional()
  checksum!: string | null;
  @ApiProperty({ enum: ImportFileStatus })
  status!: ImportFileStatus;

  static fromEntity(entity: ImportFileEntity): ImportFileResponseDto {
    return {
      id: Number(entity.id),
      type: entity.type,
      storage_provider: entity.storageProvider,
      bucket: entity.bucket,
      path: entity.path,
      original_name: entity.originalName,
      mime_type: entity.mimeType,
      size_bytes: Number(entity.sizeBytes),
      checksum: entity.checksum,
      status: entity.status,
    };
  }
}

export class ImportSessionListResponseDto {
  @ApiProperty({ type: [ImportSessionResponseDto] })
  items!: ImportSessionResponseDto[];
  @ApiProperty()
  page!: number;
  @ApiProperty()
  page_size!: number;
  @ApiProperty()
  total_items!: number;
  @ApiProperty()
  total_pages!: number;
}

export class ImportPayloadListResponseDto {
  @ApiProperty({ type: [ImportPayloadResponseDto] })
  items!: ImportPayloadResponseDto[];
  @ApiProperty()
  page!: number;
  @ApiProperty()
  page_size!: number;
  @ApiProperty()
  total_items!: number;
  @ApiProperty()
  total_pages!: number;
}

export class ImportPayloadErrorListResponseDto {
  @ApiProperty({ type: [ImportPayloadErrorResponseDto] })
  items!: ImportPayloadErrorResponseDto[];
  @ApiProperty()
  page!: number;
  @ApiProperty()
  page_size!: number;
  @ApiProperty()
  total_items!: number;
  @ApiProperty()
  total_pages!: number;
}

export class ImportFileUploadUrlResponseDto {
  @ApiProperty({ type: ImportFileResponseDto })
  file!: ImportFileResponseDto;
  @ApiProperty()
  upload_url!: string;
  @ApiProperty()
  expires_in_seconds!: number;
}

export class ImportFileDownloadUrlResponseDto {
  @ApiProperty({ type: ImportFileResponseDto })
  file!: ImportFileResponseDto;
  @ApiProperty()
  download_url!: string;
  @ApiProperty()
  expires_in_seconds!: number;
}
