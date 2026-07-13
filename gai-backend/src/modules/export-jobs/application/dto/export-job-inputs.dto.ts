import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ExportJobType } from '../../domain/enums/export-job-type.enum';

export class CreateExportJobDto {
  @ApiProperty({ enum: ExportJobType })
  @IsEnum(ExportJobType)
  type!: ExportJobType;
}
