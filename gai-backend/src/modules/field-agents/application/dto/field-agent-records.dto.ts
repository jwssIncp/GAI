import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { FIELD_AGENT_DOCUMENT_CATEGORIES } from '../../infrastructure/persistence/field-agent-document.entity';
import { BATCH_DELETE_LIMIT } from '../services/field-agent-records.service';

export class FieldAgentBatchDeleteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BATCH_DELETE_LIMIT)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids!: number[];
}

export class FieldAgentUsageQueryDto {
  /** Ids separados por vírgula: ?ids=1,2,3 */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((item) => Number(item.trim()))
          .filter((item) => item !== 0)
      : value,
  )
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BATCH_DELETE_LIMIT)
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids!: number[];
}

export class CreateFieldAgentDocumentUploadDto {
  @IsString() @MinLength(1) @MaxLength(255) original_name!: string;
  @IsString() @MinLength(3) @MaxLength(100) mime_type!: string;
  @Type(() => Number) @IsInt() @Min(1) size_bytes!: number;
  @IsOptional() @IsString() @MaxLength(128) checksum?: string | null;
  @IsOptional()
  @IsIn(FIELD_AGENT_DOCUMENT_CATEGORIES, {
    message: 'Tipo de documento inválido.',
  })
  category?: (typeof FIELD_AGENT_DOCUMENT_CATEGORIES)[number];
}

export class ConfirmFieldAgentDocumentUploadDto {
  @IsOptional() @IsString() @MaxLength(128) checksum?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) size_bytes?: number | null;
}
