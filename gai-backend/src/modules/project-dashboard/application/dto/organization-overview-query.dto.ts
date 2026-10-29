import { IsCivilDate } from '../../../../common/validation/civil-date';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ProjectStatus } from '../../../projects/domain/enums/project-status.enum';

export class OrganizationOverviewQueryDto {
  @IsOptional()
  @IsCivilDate()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  contract_from?: string;
  @IsOptional()
  @IsCivilDate()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  contract_to?: string;
  @IsOptional()
  @Matches(/^(draft|active|suspended|completed|cancelled|archived)$/)
  contract_status?: string;
  @IsOptional()
  @IsString()
  @MaxLength(120)
  segment?: string;
  @IsOptional()
  @Matches(
    /^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/,
  )
  contract_state?: string;
  @IsOptional()
  @Matches(/^(true|false)$/)
  recurring?: string;
  @IsOptional()
  @IsString()
  @MaxLength(120)
  service?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  assets_min?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  assets_max?: number;
  @IsOptional()
  @Matches(/^[a-f0-9]{64}$/)
  expected_hash?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  company_id?: number;

  @IsOptional()
  @Matches(
    /^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/,
  )
  state?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size?: number;

  @IsOptional()
  @Matches(/^(name|status|created_at|id|total|company|addresses|states)$/)
  sort?: string;

  @IsOptional()
  @Matches(/^(ASC|DESC)$/)
  direction?: 'ASC' | 'DESC';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  company_search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(9999)
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @IsCivilDate()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date_from?: string;

  @IsOptional()
  @IsCivilDate()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date_to?: string;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
