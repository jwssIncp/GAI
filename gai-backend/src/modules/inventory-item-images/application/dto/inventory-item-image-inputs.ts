import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateInventoryItemImageUploadDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @MaxLength(255)
  original_name!: string;

  @ApiProperty({ enum: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] })
  @IsString()
  @MaxLength(100)
  mime_type!: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  size_bytes!: number;

  @ApiPropertyOptional({ maxLength: 128, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  checksum?: string | null;
}

export class ConfirmInventoryItemImageUploadDto {
  @ApiPropertyOptional({ maxLength: 128, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  checksum?: string | null;

  @ApiPropertyOptional({ minimum: 1, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  size_bytes?: number | null;
}
