import { BadRequestException, ConflictException } from '@nestjs/common';
import type {
  ContractDataDto,
  ContractPaymentPlanDto,
  ContractStatus,
} from './contract.dto';
import { isCivilDate } from '../../common/validation/civil-date';
export function invalid(message: string): never {
  throw new BadRequestException({ code: 'CONTRACT_INVALID', message });
}
export function conflict(message: string): never {
  throw new ConflictException({ code: 'CONTRACT_CONFLICT', message });
}
export function cents(value: string): bigint {
  if (!/^-?\d{1,13}(\.\d{1,2})?$/.test(value))
    invalid('Valor monetário inválido.');
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = value.replace('-', '').split('.');
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  return negative ? -result : result;
}
export function money(value: bigint): string {
  const abs = value < 0n ? -value : value;
  return `${value < 0n ? '-' : ''}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
}
/** Forma de pagamento: no modo "percentages", um percentual por parcela, somando 100. */
export function normalizePaymentPlan(
  plan: ContractPaymentPlanDto | null | undefined,
): ContractPaymentPlanDto | null {
  if (!plan) return null;
  if (plan.mode === 'equal')
    return {
      mode: 'equal',
      installments: plan.installments,
      percentages: null,
    };
  const percentages = plan.percentages ?? [];
  if (percentages.length !== plan.installments)
    invalid('Informe um percentual para cada parcela.');
  const scaled = percentages.map((value) => cents(value));
  if (scaled.some((value) => value <= 0n))
    invalid('Cada parcela precisa de um percentual maior que zero.');
  if (scaled.reduce((sum, value) => sum + value, 0n) !== 10000n)
    invalid('Os percentuais das parcelas precisam somar 100%.');
  return {
    mode: 'percentages',
    installments: plan.installments,
    percentages: scaled.map((value) => money(value)),
  };
}
export function normalizeContract(input: ContractDataDto): ContractDataDto {
  if (!input.number.trim()) invalid('Informe o número do contrato.');
  const data: ContractDataDto = {
    number: input.number.trim(),
    company_id: input.company_id,
    contracted_on: input.contracted_on ?? null,
    starts_on: input.starts_on ?? null,
    ends_on: input.ends_on ?? null,
    original_value:
      input.original_value == null ? null : money(cents(input.original_value)),
    currency: input.currency,
    contracting_type: input.contracting_type?.trim() || null,
    segment: input.segment?.trim() || null,
    commercial_origin: input.commercial_origin?.trim() || null,
    commercial_origin_code: input.commercial_origin_code ?? null,
    expenses_paid_by: input.expenses_paid_by ?? null,
    tags_paid_by: input.tags_paid_by ?? null,
    payment_plan: normalizePaymentPlan(input.payment_plan),
    recurring: input.recurring ?? null,
    services: [
      ...new Set(input.services.map((s) => s.trim()).filter(Boolean)),
    ].sort(),
    estimated_assets: input.estimated_assets ?? null,
    scope: input.scope?.trim() || null,
    commercial_terms: input.commercial_terms?.trim() || null,
    status: input.status,
  };
  if (data.original_value && cents(data.original_value) < 0n)
    invalid('Valor original não pode ser negativo.');
  for (const date of [data.contracted_on, data.starts_on, data.ends_on]) {
    if (date !== null && !isCivilDate(date)) invalid('Data civil inválida.');
  }
  if (data.starts_on && data.ends_on && data.ends_on < data.starts_on)
    invalid('Vigência final anterior à inicial.');
  if (
    data.status === 'active' &&
    (!data.contracted_on ||
      !data.starts_on ||
      !data.ends_on ||
      data.original_value == null)
  )
    invalid(
      'Contrato ativo exige data de contratação, vigência e valor original.',
    );
  return data;
}
export function transition(from: ContractStatus, to: ContractStatus) {
  const allowed: Record<ContractStatus, ContractStatus[]> = {
    draft: ['active', 'cancelled'],
    active: ['suspended', 'completed', 'cancelled'],
    suspended: ['active', 'completed', 'cancelled'],
    completed: [],
    cancelled: [],
    archived: [],
  };
  if (from !== to && !allowed[from].includes(to))
    conflict('Transição de status contratual não permitida.');
}
