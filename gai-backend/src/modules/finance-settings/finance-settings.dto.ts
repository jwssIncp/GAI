import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsCivilDate } from '../../common/validation/civil-date';
import {
  FIXED_COST_ITEM_MODES,
  type FixedCostItemMode,
} from './finance-settings.policy';

const MONEY = /^\d{1,13}(\.\d{1,2})?$/;
const PERCENT = /^\d{1,3}(\.\d{1,2})?$/;

export class CommercialOriginDto {
  @IsString() @Matches(/^[a-z0-9_]{2,40}$/) code!: string;
  @IsString() @MinLength(2) @MaxLength(60) label!: string;
  @IsString() @Matches(PERCENT) commission_pct!: string;
}

export class FixedCostItemModesDto {
  @IsIn(FIXED_COST_ITEM_MODES) additional_income_tax!: FixedCostItemMode;
  @IsIn(FIXED_COST_ITEM_MODES) equipment!: FixedCostItemMode;
  @IsIn(FIXED_COST_ITEM_MODES) back_office!: FixedCostItemMode;
}

/** Valor mensal de cada item de custo fixo (usado quando o modo é "fixo"). */
export class FixedCostItemAmountsDto {
  @IsString() @Matches(MONEY) additional_income_tax!: string;
  @IsString() @Matches(MONEY) equipment!: string;
  @IsString() @Matches(MONEY) back_office!: string;
}

export class FinanceSettingsValuesDto {
  @IsString() @Matches(PERCENT) income_tax_pct!: string;
  @IsString() @Matches(PERCENT) tag_tax_pct!: string;
  @IsString() @Matches(MONEY) default_daily_rate!: string;
  @IsInt() @Min(1) @Max(1000000) budget_productivity_items_per_day!: number;
  @IsString() @Matches(PERCENT) budgeted_non_reimbursable_expense_pct!: string;
  @IsString() @Matches(PERCENT) technician_expense_alert_pct!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CommercialOriginDto)
  commercial_origins!: CommercialOriginDto[];
  @IsString() @Matches(PERCENT) partner_commission_pct!: string;
  @IsString() @Matches(MONEY) fixed_cost_operation!: string;
  @IsString() @Matches(MONEY) fixed_cost_branch!: string;
  @ValidateNested()
  @Type(() => FixedCostItemModesDto)
  fixed_cost_item_modes!: FixedCostItemModesDto;
  @ValidateNested()
  @Type(() => FixedCostItemAmountsDto)
  fixed_cost_item_amounts!: FixedCostItemAmountsDto;
  @IsString() @Matches(PERCENT) economic_break_even_margin_pct!: string;
  @IsInt() @Min(0) @Max(365) first_installment_days_after_contract!: number;
  /**
   * Mês de corte da DRE automática. Opcional na publicação: sem ele, a versão
   * nova herda o corte da versão vizinha (na 1ª versão, o mês de início).
   */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  dre_regime_cutoff_month!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  expense_reasons!: string[];
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  tag_models!: string[];
  @IsString() @MinLength(1) @MaxLength(120) default_tag_supplier!: string;
  @IsInt() @Min(1024) field_agent_document_max_bytes!: number;
  @IsInt() @Min(1024) expense_attachment_max_bytes!: number;
  @IsInt() @Min(1) @Max(50) expense_attachment_max_files!: number;
  @IsBoolean() require_approval!: boolean;
}

export class PublishFinanceSettingsDto {
  @IsCivilDate()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  valid_from!: string;
  @IsString() @MinLength(5) @MaxLength(2000) reason!: string;
  @ValidateNested()
  @Type(() => FinanceSettingsValuesDto)
  values!: FinanceSettingsValuesDto;
  /**
   * Confirma a mudança do mês de corte em relação à versão vizinha. Sem ela,
   * um corte diferente do herdado é recusado (409) com os meses que mudariam
   * de regime.
   */
  @IsOptional() @IsBoolean() change_cutoff?: boolean;
}

export class FinanceSettingsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) organization_id?: number;
}

export interface FinanceSettingsVersionResponse {
  id: number;
  organization_id: number;
  version: number;
  valid_from: string;
  values: FinanceSettingsValuesDto;
  reason: string;
  actor_id: number | null;
  actor_name: string | null;
  recorded_at: string;
}

export interface FinanceSettingsOverviewResponse {
  organization_id: number;
  today: string;
  /** Data do lançamento financeiro mais antigo (sugestão de "vale a partir de"). */
  earliest_fact_date: string | null;
  /** Início da versão mais antiga: antes dele, nenhum parâmetro vigente. */
  coverage_start: string | null;
  current: FinanceSettingsVersionResponse | null;
  scheduled: FinanceSettingsVersionResponse | null;
  versions: FinanceSettingsVersionResponse[];
  platform_max_upload_bytes: number;
}
