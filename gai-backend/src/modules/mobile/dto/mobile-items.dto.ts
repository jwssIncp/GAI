import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { MONEY_PATTERN } from '../../inventory-items/application/dto/inventory-item-inputs';

/** Device-generated item id (e.g. "1730736000123456"); always a string. */
export const EXTERNAL_ITEM_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;

const text = (max?: number) => {
  const decorators = [
    IsOptional(),
    ValidateIf((_, v) => v !== null),
    IsString(),
  ];
  return max ? [...decorators, MaxLength(max)] : decorators;
};
const apply =
  (decorators: PropertyDecorator[]): PropertyDecorator =>
  (target, key) =>
    decorators.forEach((decorator) => decorator(target, key));

/**
 * Upsert body. Absent fields keep the server value, `null` clears it. The
 * external id comes only from the URL. Status, ownership, organization and
 * project are never accepted from the app.
 */
export class MobileItemUpsertDto {
  @ApiPropertyOptional({
    type: 'integer',
    nullable: true,
    description:
      'Versão do item que o aparelho conhece (campo `version`). Obrigatória para alterar um item existente; omita ao criar.',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  base_version?: number | null;

  @ApiPropertyOptional({ nullable: true }) @apply(text(50)) sequence?:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true }) @apply(text(100)) old_plate?:
    | string
    | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Segunda placa antiga (legado placa_antiga_2)',
  })
  @apply(text(100))
  old_plate_2?: string | null;
  @ApiPropertyOptional({ nullable: true }) @apply(text(100)) new_plate?:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true }) @apply(text(255)) unit_text?:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true }) @apply(text(2000)) address_text?:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true }) @apply(text(2000)) location_text?:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true }) @apply(text(4000)) description?:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true }) @apply(text(100)) brand?:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true }) @apply(text(100)) model?:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true }) @apply(text(100)) serial_number?:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true }) @apply(text(100)) capacity?:
    | string
    | null;

  @ApiPropertyOptional({ nullable: true, minimum: 1900, maximum: 2100 })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(1900)
  @Max(2100)
  year?: number | null;

  @ApiPropertyOptional({ nullable: true }) @apply(text(4000)) notes?:
    | string
    | null;

  @ApiPropertyOptional({ nullable: true, example: '150.00' })
  @apply(text())
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(MONEY_PATTERN)
  used_value?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '900.00' })
  @apply(text())
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(MONEY_PATTERN)
  new_value?: string | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
    nullable: true,
    description:
      'Campos extras do projeto (legado extra_fields): texto por nome',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsObject()
  extra_fields?: Record<string, string> | null;
}

export class MobileItemDeleteQueryDto {
  @ApiPropertyOptional({ type: 'integer' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  base_version?: number;
}

export class MobileItemListQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  new_plate?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  old_plate?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Type(() => String)
  @Matches(/^(true|false)$/)
  include_deleted?: string;
}

export class MobileItemSyncQueryDto {
  @ApiPropertyOptional({ description: 'next_cursor da página anterior' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 500, default: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class MobileImageUploadDto {
  @ApiPropertyOptional() @IsString() @MaxLength(255) original_name!: string;
  @ApiPropertyOptional({ example: 'image/jpeg' })
  @IsString()
  @MaxLength(100)
  mime_type!: string;
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  size_bytes!: number;
  @ApiPropertyOptional({ description: 'SHA-256 hex (opcional)' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  checksum?: string;
}

export class MobileImageConfirmDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  size_bytes?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  checksum?: string;
}

export class MobileImageListQueryDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Type(() => String)
  @Matches(/^(true|false)$/)
  with_urls?: string;
}
