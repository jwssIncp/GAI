import { BadRequestException, ConflictException } from '@nestjs/common';
import { monthlyDueDate } from '../expense-accountabilities/monthly-due-date.policy';
import { isCivilDate } from '../../common/validation/civil-date';
import type {
  BudgetDataDto,
  BudgetPaymentDto,
  PricingValuesDto,
} from './budget.dto';
export const PRICING_KEYS = [
  'currency',
  'productivity',
  'default_days',
  'default_professionals',
  'addresses_per_person_day',
  'address_factor',
  'daily_rate',
  'operational_fixed',
  'travel_fixed',
  'transport_per_day',
  'lodging_per_room_day',
  'food_per_person_day',
  'materials_fixed',
  'tags_per_asset',
  'administration_fixed',
  'minimum_price',
  'room_capacity',
  'extra_every_days',
  'extra_days',
  'tax_pct',
  'commission_pct',
  'margin_pct',
] as const;
export const MONEY_KEYS = [
  'daily_rate',
  'operational_fixed',
  'travel_fixed',
  'transport_per_day',
  'lodging_per_room_day',
  'food_per_person_day',
  'materials_fixed',
  'tags_per_asset',
  'administration_fixed',
  'minimum_price',
] as const;
export const ENGINE_VERSION = 'budget-cost-gross-up-v1';
const MAX_MONEY = 999999999999999n;
export function invalid(message: string): never {
  throw new BadRequestException({ code: 'BUDGET_INVALID', message });
}
export function conflict(message: string): never {
  throw new ConflictException({ code: 'BUDGET_CONFLICT', message });
}
export function scaled(value: string, digits = 2): bigint {
  if (
    typeof value !== 'string' ||
    !new RegExp(`^\\d{1,13}(\\.\\d{1,${digits}})?$`).test(value)
  )
    invalid(
      'Número decimal inválido. Use ponto decimal, sem sinal ou notação científica.',
    );
  const [whole, fraction = ''] = value.split('.');
  return (
    BigInt(whole) * 10n ** BigInt(digits) + BigInt(fraction.padEnd(digits, '0'))
  );
}
export function decimal(value: bigint, digits = 2): string {
  const scale = 10n ** BigInt(digits),
    abs = value < 0n ? -value : value;
  return `${value < 0n ? '-' : ''}${abs / scale}.${String(abs % scale).padStart(digits, '0')}`;
}
const ceil = (n: bigint, d: bigint) => {
  if (d <= 0n) invalid('Divisor deve ser positivo.');
  return (n + d - 1n) / d;
};
const half = (n: bigint, d: bigint) => (n + d / 2n) / d;
export function civil(value: string): string {
  if (!isCivilDate(value)) invalid('Data civil inválida.');
  return value;
}
export function pricingValues(dto: PricingValuesDto): PricingValuesDto {
  const out = Object.fromEntries(
    PRICING_KEYS.map((k) => [k, dto[k]]),
  ) as unknown as PricingValuesDto;
  for (const k of MONEY_KEYS) out[k] = decimal(scaled(out[k]));
  for (const k of ['tax_pct', 'commission_pct', 'margin_pct'] as const)
    out[k] = decimal(scaled(out[k]));
  out.address_factor = decimal(scaled(out.address_factor, 4), 4);
  if (scaled(out.address_factor, 4) <= 0n)
    invalid('Fator por endereço deve ser positivo.');
  if (
    scaled(out.tax_pct) + scaled(out.commission_pct) + scaled(out.margin_pct) >=
    10000n
  )
    invalid('Impostos, comissão e margem devem somar menos de 100%.');
  if (
    out.productivity <= 0 ||
    out.addresses_per_person_day <= 0 ||
    out.default_days <= 0 ||
    out.default_professionals <= 0 ||
    out.room_capacity <= 0 ||
    out.extra_every_days <= 0
  )
    invalid('Produtividade, capacidade, equipe e dias devem ser positivos.');
  return out;
}
export function hasAdjustments(dto: BudgetDataDto) {
  return Object.entries(dto.sizing).some(
    ([k, v]) => k !== 'adjustment_reason' && v != null,
  );
}
export interface PaymentRow {
  position: number;
  kind: 'entry' | 'installment';
  due_on: string;
  amount: string;
  percentage: string;
}
export function paymentPlan(
  total: bigint,
  p: BudgetPaymentDto,
  preparedOn: string,
) {
  civil(p.first_due_on);
  if (p.first_due_on < preparedOn)
    invalid('Primeiro vencimento anterior à elaboração.');
  if (p.entry_amount != null && p.entry_percent != null)
    invalid('Use entrada por valor ou percentual, não ambos.');
  const entryPct = scaled(p.entry_percent ?? '0');
  if (entryPct > 10000n) invalid('Entrada superior a 100%.');
  const entry =
    p.entry_amount != null
      ? scaled(p.entry_amount)
      : half(total * entryPct, 10000n);
  if (entry > total) invalid('Entrada superior ao preço final.');
  const balance = total - entry;
  if ((balance > 0n && p.count < 1) || (balance === 0n && p.count !== 0))
    invalid('Quantidade de parcelas incompatível com o saldo.');
  if (p.count < 0 || p.count > 60) invalid('Utilize até 60 parcelas.');
  let amounts: bigint[];
  if (p.mode === 'equal') {
    if (p.percentages?.length || p.amounts?.length)
      invalid(
        'Parcelamento igual não aceita valores/percentuais customizados.',
      );
    const base = p.count ? balance / BigInt(p.count) : 0n;
    amounts = Array.from({ length: p.count }, (_, i) =>
      i === p.count - 1 ? balance - base * BigInt(p.count - 1) : base,
    );
  } else if (p.mode === 'percentages') {
    if (
      p.entry_amount != null ||
      p.amounts?.length ||
      p.percentages?.length !== p.count
    )
      invalid(
        'Percentuais exigem entrada percentual e uma porcentagem por parcela.',
      );
    const percentages = (p.percentages ?? []).map((v) => scaled(v));
    if (percentages.reduce((a, b) => a + b, entryPct) !== 10000n)
      invalid('Percentuais de entrada e parcelas devem somar exatamente 100%.');
    amounts = percentages.map((v) => half(total * v, 10000n));
    if (amounts.length)
      amounts[amounts.length - 1] =
        balance - amounts.slice(0, -1).reduce((a, b) => a + b, 0n);
  } else if (p.mode === 'amounts') {
    if (p.percentages?.length || p.amounts?.length !== p.count)
      invalid('Informe um valor para cada parcela.');
    amounts = (p.amounts ?? []).map((v) => scaled(v));
    if (amounts.reduce((a, b) => a + b, 0n) !== balance)
      invalid('Valores das parcelas não fecham o saldo restante.');
  } else invalid('Modo de pagamento inválido.');
  if (amounts.some((v) => v < 0n))
    invalid('O arredondamento gerou parcela negativa; ajuste os percentuais.');
  if (p.dates && p.dates.length !== p.count)
    invalid('Informe uma data para cada parcela.');
  const rows: PaymentRow[] = [];
  if (entry > 0n) {
    const due = civil(p.entry_due_on ?? p.first_due_on);
    if (due < preparedOn || due > p.first_due_on)
      invalid('Data da entrada incompatível com a elaboração/parcelas.');
    rows.push({
      position: 0,
      kind: 'entry',
      due_on: due,
      amount: decimal(entry),
      percentage: '',
    });
  }
  amounts.forEach((amount, i) => {
    const due = civil(
      p.dates?.[i] ??
        monthlyDueDate(new Date(p.first_due_on + 'T00:00:00Z'), i)
          .toISOString()
          .slice(0, 10),
    );
    if (
      due < preparedOn ||
      (i > 0 && due < rows[rows.length - 1].due_on) ||
      (rows.length && due < rows[0].due_on)
    )
      invalid('Vencimentos devem ser ordenados e posteriores à elaboração.');
    rows.push({
      position: i + 1,
      kind: 'installment',
      due_on: due,
      amount: decimal(amount),
      percentage: '',
    });
  });
  let allocated = 0n;
  rows.forEach((r, i) => {
    const value =
      total === 0n
        ? 0n
        : i === rows.length - 1
          ? 1000000n - allocated
          : (scaled(r.amount) * 1000000n) / total;
    allocated += value;
    r.percentage = decimal(value, 4);
  });
  return {
    mode: p.mode,
    entry: decimal(entry),
    financed_balance: decimal(balance),
    total: decimal(total),
    remaining_balance: '0.00',
    rows,
  };
}
export interface CostLine {
  key: string;
  label: string;
  quantity: number;
  unit_value: string;
  subtotal: string;
  formula: string;
}
export function calculateBudget(
  dto: BudgetDataDto,
  pricing: PricingValuesDto,
  addressCount: number,
) {
  const p = pricingValues(pricing),
    s = dto.sizing;
  civil(dto.prepared_on);
  civil(dto.valid_until);
  if (dto.valid_until < dto.prepared_on)
    invalid('Validade anterior à elaboração.');
  if (hasAdjustments(dto) && (s.adjustment_reason?.trim().length ?? 0) < 5)
    invalid('Ajustes manuais exigem justificativa.');
  const productivity = s.productivity ?? p.productivity,
    available = s.available_days ?? p.default_days;
  const factor = scaled(p.address_factor, 4);
  const effortAssets = ceil(
    BigInt(dto.estimated_assets) * factor,
    BigInt(productivity) * 10000n,
  );
  const effortAddresses = ceil(
    BigInt(addressCount),
    BigInt(p.addresses_per_person_day),
  );
  const effort =
    effortAssets > effortAddresses ? effortAssets : effortAddresses;
  const required = Number(ceil(effort, BigInt(available)));
  const team = s.team ?? Math.max(required, p.default_professionals);
  if (team < required || team > 500)
    invalid(
      'Equipe insuficiente para o prazo ou superior ao limite de 500 profissionais.',
    );
  const days = Number(ceil(effort, BigInt(team)));
  if (days > 3650) invalid('Prazo calculado excede 3.650 dias.');
  const extra = Math.floor(days / p.extra_every_days) * p.extra_days;
  const stay = days + extra,
    rooms = days ? Math.ceil(team / p.room_capacity) : 0;
  const lines: CostLine[] = [];
  const line = (
    key: string,
    label: string,
    quantity: number,
    unit: string,
    formula: string,
  ) =>
    lines.push({
      key,
      label,
      quantity,
      unit_value: decimal(scaled(unit)),
      subtotal: decimal(BigInt(quantity) * scaled(unit)),
      formula,
    });
  line(
    'technical',
    'Equipe técnica',
    team * days,
    p.daily_rate,
    'equipe × dias de campo × diária',
  );
  line(
    'operational',
    'Despesas operacionais',
    1,
    p.operational_fixed,
    'custo operacional fixo',
  );
  line(
    'travel',
    'Deslocamentos',
    1,
    p.travel_fixed,
    'deslocamento fixo informado',
  );
  line(
    'transport',
    'Transporte local',
    stay,
    p.transport_per_day,
    'dias de permanência × transporte/dia',
  );
  line(
    'lodging',
    'Hospedagem',
    rooms * stay,
    p.lodging_per_room_day,
    'ceil(equipe/capacidade do quarto) × permanência × diária/quarto',
  );
  line(
    'food',
    'Alimentação',
    team * stay,
    p.food_per_person_day,
    'equipe × permanência × alimentação/dia',
  );
  line(
    'materials',
    'Materiais',
    1,
    p.materials_fixed,
    'custo fixo de materiais',
  );
  line(
    'tags',
    'Plaquetas',
    dto.estimated_assets,
    p.tags_per_asset,
    'bens estimados × custo unitário da plaqueta',
  );
  line(
    'administration',
    'Custos administrativos',
    1,
    p.administration_fixed,
    'custo administrativo fixo',
  );
  if (s.operational_extra != null)
    line(
      'manual_extra',
      'Acréscimo operacional manual',
      1,
      s.operational_extra,
      s.adjustment_reason!,
    );
  const cost = lines.reduce((a, l) => a + scaled(l.subtotal), 0n);
  const tax = scaled(p.tax_pct),
    commission = scaled(p.commission_pct),
    margin = scaled(s.margin_pct ?? p.margin_pct);
  const denominator = 10000n - tax - commission - margin;
  if (denominator <= 0n)
    invalid('Impostos, comissão e margem devem somar menos de 100%.');
  const gross = ceil(cost * 10000n, denominator),
    floor = scaled(p.minimum_price);
  const suggested = gross > floor ? gross : floor;
  const final = s.final_price == null ? suggested : scaled(s.final_price);
  if (
    final < floor ||
    final < cost + half(final * tax, 10000n) + half(final * commission, 10000n)
  )
    invalid(
      'Preço manual abaixo do piso ou insuficiente para cobrir custos, impostos e comissão.',
    );
  if (final > MAX_MONEY || cost > MAX_MONEY)
    invalid('Valor excede o limite monetário de 9.999.999.999.999,99.');
  const taxAmount = half(final * tax, 10000n),
    commissionAmount = half(final * commission, 10000n);
  return {
    engine_version: ENGINE_VERSION,
    currency: p.currency,
    inputs: {
      assets: dto.estimated_assets,
      address_count: addressCount,
      productivity,
      address_factor: p.address_factor,
      available_days: available,
    },
    sizing: {
      effort_assets: Number(effortAssets),
      effort_addresses: Number(effortAddresses),
      person_days: Number(effort),
      required_team: required,
      team,
      field_days: days,
      extra_days: extra,
      stay_days: stay,
      rooms,
    },
    formulas: {
      effort:
        'max(ceil(bens × fator / produtividade), ceil(endereços / endereços por profissional-dia))',
      team: 'max(ceil(pessoas-dia / dias disponíveis), equipe configurada); ajuste explícito pode substituir',
      days: 'ceil(pessoas-dia / equipe)',
      extra:
        'floor(dias de campo / intervalo configurado) × dias extras configurados',
      price:
        'ceil_centavo(custo / (1 − imposto − comissão − margem)); aplicar piso',
      payments:
        'entrada + parcelas = preço final; última parcela absorve residual de centavos; datas mensais a partir da data original',
    },
    lines,
    cost_total: decimal(cost),
    rates: {
      tax_pct: p.tax_pct,
      commission_pct: p.commission_pct,
      margin_pct: decimal(margin),
    },
    gross_up_price: decimal(gross),
    minimum_price: decimal(floor),
    suggested_price: decimal(suggested),
    final_price: decimal(final),
    tax_amount: decimal(taxAmount),
    commission_amount: decimal(commissionAmount),
    margin_amount: decimal(final - cost - taxAmount - commissionAmount),
    manual_adjustments: hasAdjustments(dto)
      ? { ...s, reason: s.adjustment_reason!.trim() }
      : null,
    payment: paymentPlan(final, dto.payment, dto.prepared_on),
  };
}
export type BudgetCalculation = ReturnType<typeof calculateBudget>;
