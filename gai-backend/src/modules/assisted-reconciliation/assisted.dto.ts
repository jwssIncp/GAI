import { Type } from 'class-transformer';
import {
  Equals,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
export class MatchingConfigDto {
  @Equals(1) version!: 1;
  @IsNumber() @Min(0.8) @Max(1) textThreshold!: number;
  @IsNumber() @Min(0.75) @Max(1) localTextThreshold!: number;
  @IsNumber() @Min(0) @Max(0.5) descriptionAlertThreshold!: number;
}
export class GenerateAssistedDto {
  @IsOptional() @IsInt() @Min(0) after_item_id = 0;
  @IsOptional()
  @ValidateNested()
  @Type(() => MatchingConfigDto)
  config?: MatchingConfigDto;
}
export class AssistedPageQuery {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) page_size = 20;
  @IsOptional() @IsIn(['pending', 'approved', 'rejected']) status?: string;
}
export class DecideAssistedDto {
  @IsInt() @Min(1) revision!: number;
  @IsString() @Length(64, 64) source_hash!: string;
  @IsIn(['approved', 'rejected']) action!: 'approved' | 'rejected';
  @IsString() @Length(5, 2000) reason!: string;
  @IsString() @Length(8, 80) command_key!: string;
}
