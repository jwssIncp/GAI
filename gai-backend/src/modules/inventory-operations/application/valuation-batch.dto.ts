import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDefined,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateAssetValuationDto } from './inventory-operation.dto';
import { InventoryItemStatus } from '../../inventory-items/domain/enums/inventory-item-status.enum';
export class ValuationFiltersDto {
  @IsOptional() @IsString() @MaxLength(255) search?: string;
  @IsOptional() @IsEnum(InventoryItemStatus) status?: InventoryItemStatus;
  @IsOptional() @IsString() @MaxLength(100) old_plate?: string;
  @IsOptional() @IsString() @MaxLength(100) new_plate?: string;
  @IsOptional() @IsString() @MaxLength(255) description?: string;
}
export class ValuationSelectionDto {
  @IsIn(['ids', 'filters']) kind!: 'ids' | 'filters';
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids?: number[];
  @IsOptional()
  @ValidateNested()
  @Type(() => ValuationFiltersDto)
  filters?: ValuationFiltersDto;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  exclude_ids?: number[];
}
export class ValuationSelectionRequest {
  @IsDefined()
  @ValidateNested()
  @Type(() => ValuationSelectionDto)
  selection!: ValuationSelectionDto;
}
export class IndividualValuationDto {
  @IsInt() @Min(1) inventory_item_id!: number;
  @IsOptional() @IsString() new_value?: string | null;
  @IsOptional() @IsString() used_value?: string | null;
}
export class PreviewValuationBatchDto extends ValuationSelectionRequest {
  @IsIn(['common', 'individual']) mode!: 'common' | 'individual';
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateAssetValuationDto)
  common!: CreateAssetValuationDto;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => IndividualValuationDto)
  values?: IndividualValuationDto[];
  @IsString() @Length(8, 80) command_key!: string;
}
export class ConfirmValuationBatchDto {
  @IsInt() @Min(1) revision!: number;
  @IsString() @Length(64, 64) preview_hash!: string;
  @IsString() @Length(8, 80) command_key!: string;
}
