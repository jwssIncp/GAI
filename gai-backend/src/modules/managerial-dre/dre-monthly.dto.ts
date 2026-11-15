import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { DreCommandDto, DreScopeDto } from './dre.dto';

export class DreMonthlyQueryDto extends DreScopeDto {
  @Matches(/^\d{4}$/) year!: string;
  @IsOptional() @Matches(/^\d{4}$/) compare_year?: string;
  /** Data de referência (testes); padrão: hoje em São Paulo. */
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) as_of?: string;
}

export class DreRulesDto extends DreCommandDto {
  /** tipo → id da conta (nulo remove a associação). */
  @IsObject() rules!: Record<string, number | null>;
}

export class DreLayoutDto extends DreCommandDto {
  @Type(() => Number) @IsInt() @Min(0) revision!: number;
  @IsArray() @ArrayMaxSize(1000) @IsInt({ each: true }) hidden!: number[];
  @IsArray() @ArrayMaxSize(1000) @IsInt({ each: true }) summary!: number[];
  @IsArray()
  @ArrayMaxSize(1000)
  @IsInt({ each: true })
  post_operational!: number[];
}

export class DreCellDto extends DreCommandDto {
  @Type(() => Number) @IsInt() @Min(1) account_id!: number;
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) month!: string;
  /** Valor com sinal; nulo apaga o lançamento (volta a estimativa, se houver). */
  @IsOptional()
  @Matches(/^-?\d{1,13}(\.\d{1,2})?$/)
  amount!: string | null;
}

export class DreImportPreviewDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) organization_id?: number;
  @Matches(/^\d{4}$/) year!: string;
  /** JSON: rótulo da linha da planilha → id da conta (para linhas não reconhecidas). */
  @IsOptional() @IsString() @MaxLength(20000) mapping?: string;
}

export class DreImportConfirmDto extends DreImportPreviewDto {
  @Matches(/^[a-f0-9]{64}$/) checksum!: string;
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,99}$/)
  command_key!: string;
  @IsString() @MaxLength(2000) reason!: string;
}
