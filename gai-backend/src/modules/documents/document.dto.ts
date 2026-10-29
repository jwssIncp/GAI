import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
export class GenerateDocumentDto {
  @IsIn(['pdf', 'docx']) format!: 'pdf' | 'docx';
  @IsOptional() @IsBoolean() include_memory?: boolean;
}
export class VisualTemplateDto {
  @IsString() @MinLength(2) @MaxLength(180) organization_name!: string;
  @IsString() @MaxLength(1500) institutional!: string;
  @Matches(/^#[a-fA-F0-9]{6}$/) primary_color!: string;
  @IsString() @MaxLength(120) header!: string;
  @IsString() @MaxLength(120) footer!: string;
  @IsIn(['Roboto', 'Times']) font!: 'Roboto' | 'Times';
  @IsBoolean() cover!: boolean;
  @IsOptional() @IsString() @MaxLength(180000) logo_png?: string | null;
}
