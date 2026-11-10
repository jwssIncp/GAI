import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ExpenseInputDto } from '../../payments-expenses/application/dto/payments-expenses-inputs';
import {
  EXTERNAL_ITEM_ID_PATTERN,
  MobileItemUpsertDto,
} from './mobile-items.dto';

const CLIENT_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,99}$/;

// ---------- Plates ----------

export class MobilePlateCheckQueryDto {
  @ApiProperty({ example: '251' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  plate!: string;

  @ApiPropertyOptional({ enum: ['new', 'old', 'any'], default: 'any' })
  @IsOptional()
  @IsIn(['new', 'old', 'any'])
  kind?: 'new' | 'old' | 'any';

  @ApiPropertyOptional({
    description: 'Item em edição (não conta como duplicata)',
  })
  @IsOptional()
  @Matches(EXTERNAL_ITEM_ID_PATTERN)
  exclude_external_id?: string;
}

export class MobilePlateReportQueryDto {
  @ApiPropertyOptional({
    description: 'Início da faixa de placas novas (numérica)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  from?: number;

  @ApiPropertyOptional({
    description: 'Fim da faixa de placas novas (numérica)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  to?: number;
}

// ---------- Expenses ----------

/** Same validation as the web expense (YYYY-MM-DD, "120.50"), the field agent
 * comes from the session and a client key makes creation idempotent. */
export class MobileExpenseCreateDto extends OmitType(ExpenseInputDto, [
  'field_agent_id',
] as const) {
  @ApiProperty({ description: 'Chave gerada no aparelho (8–100 caracteres)' })
  @Matches(CLIENT_KEY)
  client_expense_id!: string;
}

// ---------- Reconciliation (import sessions) ----------

export class MobileImportSessionCreateDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  unidade?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 1000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  expected_payloads?: number;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  device_label?: string;
}

export class MobileImportFileDto {
  @ApiProperty({ enum: ['image', 'raw_backup'] })
  @IsIn(['image', 'raw_backup'])
  type!: 'image' | 'raw_backup';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  original_name!: string;
  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  @MaxLength(100)
  mime_type!: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) size_bytes!: number;
}

export class MobileImportConfirmDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  size_bytes?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[a-f0-9]{64}$/)
  checksum?: string;
}

export class MobileImportImageRefDto {
  @ApiProperty({ description: 'file_id devolvido pelo upload-url da sessão' })
  @IsInt()
  @Min(1)
  file_id!: number;
}

export class MobileImportItemDto extends OmitType(MobileItemUpsertDto, [
  'base_version',
] as const) {
  @ApiProperty({ enum: ['upsert', 'delete'] })
  @IsIn(['upsert', 'delete'])
  operation!: 'upsert' | 'delete';

  @ApiProperty({ example: '1730736000123456' })
  @Matches(EXTERNAL_ITEM_ID_PATTERN)
  external_item_id!: string;

  @ApiPropertyOptional({ type: [MobileImportImageRefDto], maxItems: 50 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => MobileImportImageRefDto)
  images?: MobileImportImageRefDto[];
}

export class MobileImportPayloadDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) payload_number!: number;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @Length(8, 128)
  idempotency_key!: string;

  @ApiProperty({ type: [MobileImportItemDto], maxItems: 1000 })
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => MobileImportItemDto)
  items!: MobileImportItemDto[];
}

export class MobileImportErrorsQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size?: number;
}
