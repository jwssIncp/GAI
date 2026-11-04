import { IsCivilDate } from '../../common/validation/civil-date';
import { Type } from 'class-transformer';
import {
  IsDefined,
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
import { BudgetPaymentDto } from '../budgets/budget.dto';
export class FinanceFilterDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) organization_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) company_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) project_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) contract_id?: number;
  @IsOptional() @IsCivilDate() date_from?: string;
  @IsOptional() @IsCivilDate() date_to?: string;
  @IsOptional()
  @IsIn(['open', 'partial', 'paid', 'cancelled', 'overdue'])
  status?: string;
  @IsOptional() @IsIn(['all', 'expected', 'actual']) view?: string;
  @IsOptional() @IsIn(['all', 'in', 'out']) direction?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) page_size = 20;
}
export class ReceivableInputDto {
  @IsOptional() @IsInt() @Min(1) organization_id?: number;
  @IsInt() @Min(1) company_id!: number;
  @IsOptional() @IsInt() @Min(1) project_id?: number;
  @IsIn(['manual', 'contract', 'amendment', 'budget']) origin!: string;
  @IsOptional() @IsInt() @Min(1) source_id?: number;
  @IsString() @MinLength(3) @MaxLength(500) description!: string;
  @IsString() @Matches(/^\d{1,13}(\.\d{1,2})?$/) amount!: string;
  @IsIn(['BRL', 'USD', 'EUR']) currency!: string;
  @IsCivilDate() issued_on!: string;
  @IsOptional() @IsString() @MaxLength(255) document?: string;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
  @IsString() @MinLength(5) @MaxLength(2000) reason!: string;
  @IsDefined()
  @ValidateNested()
  @Type(() => BudgetPaymentDto)
  payment!: BudgetPaymentDto;
}
export class ConfirmReceivableDto extends ReceivableInputDto {
  @Matches(/^[a-f0-9]{64}$/) preview_hash!: string;
  @IsString() @MinLength(8) @MaxLength(100) command_key!: string;
}
export class EditReceivableDto {
  @IsInt() @Min(1) revision!: number;
  @IsString() @MinLength(8) @MaxLength(100) command_key!: string;
  @IsString() @MinLength(5) @MaxLength(2000) reason!: string;
  @IsString() @MinLength(3) @MaxLength(500) description!: string;
  @IsOptional() @IsString() @MaxLength(255) document?: string;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
}
export class FinanceCommandDto {
  @IsInt() @Min(1) revision!: number;
  @IsString() @MinLength(8) @MaxLength(100) command_key!: string;
  @IsString() @MinLength(5) @MaxLength(2000) reason!: string;
}
export class ReceiptDto extends FinanceCommandDto {
  @IsInt() @Min(1) installment_id!: number;
  @Matches(/^\d{1,13}(\.\d{1,2})?$/) amount!: string;
  @IsCivilDate() received_on!: string;
  @IsString() @MinLength(2) @MaxLength(100) method!: string;
  @IsString() @MinLength(2) @MaxLength(255) reference!: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
export class ReverseReceiptDto extends FinanceCommandDto {
  @IsCivilDate() reversed_on!: string;
}
export class FinanceExportDto {
  @IsIn([
    'receivables',
    'installments',
    'receipts',
    'expected',
    'actual',
    'statement',
  ])
  kind!: string;
  @IsDefined()
  @ValidateNested()
  @Type(() => FinanceFilterDto)
  filters!: FinanceFilterDto;
}
