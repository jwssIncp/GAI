/**
 * Fórmulas da remuneração do inventariante (doc 06 §2.3), em centavos inteiros
 * (BigInt): nada de ponto flutuante em dinheiro.
 *
 * - dias  = dias úteis (segunda a sexta) entre data_inicial e data_final,
 *           contando os dois extremos; feriados não são descontados
 * - total = dias × diária + adicional          (ou o total informado à mão)
 * - final = total − descontos                  (não pode ser negativo)
 * - daily_total (dias × diária) continua sendo gravado por compatibilidade.
 */
const MONEY = /^\d{1,13}(\.\d{1,2})?$/;
const DAY_MS = 86_400_000;

export class RemunerationRuleError extends Error {}

export function toCents(value: string): bigint {
  if (typeof value !== 'string' || !MONEY.test(value))
    throw new RemunerationRuleError(
      'Valores monetários devem usar ponto decimal e até duas casas.',
    );
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

export function fromCents(value: bigint): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  return `${negative ? '-' : ''}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
}

/** Datas civis (AAAA-MM-DD ou Date em UTC à meia-noite), contando os dois extremos. */
export function daysInclusive(start: Date, end: Date): number {
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  if (days < 1)
    throw new RemunerationRuleError(
      'A data final não pode ser anterior à data inicial.',
    );
  return days;
}

/**
 * Dias de segunda a sexta entre duas datas civis (UTC à meia-noite), contando os dois
 * extremos. Período só de fim de semana dá 0.
 */
export function weekdaysInclusive(start: Date, end: Date): number {
  const total = daysInclusive(start, end);
  const fullWeeks = Math.floor(total / 7);
  let days = fullWeeks * 5;
  const firstWeekday = (start.getUTCDay() + fullWeeks * 7) % 7;
  for (let i = 0; i < total % 7; i += 1) {
    const weekday = (firstWeekday + i) % 7;
    if (weekday !== 0 && weekday !== 6) days += 1;
  }
  return days;
}

export interface RemunerationInput {
  days: number;
  dailyRate: string;
  additionalAmount: string;
  discountAmount: string;
  /** Total informado à mão; quando presente, substitui dias × diária + adicional. */
  manualTotal?: string | null;
}

export interface RemunerationTotals {
  dailyTotal: string;
  totalAmount: string;
  finalAmount: string;
  totalManual: boolean;
}

export function remunerationTotals(
  input: RemunerationInput,
): RemunerationTotals {
  if (!Number.isInteger(input.days) || input.days < 0)
    throw new RemunerationRuleError('Dias deve ser um inteiro não negativo.');
  const dailyTotal = BigInt(input.days) * toCents(input.dailyRate);
  const manual = input.manualTotal != null && input.manualTotal !== '';
  const total = manual
    ? toCents(input.manualTotal!)
    : dailyTotal + toCents(input.additionalAmount);
  const final = total - toCents(input.discountAmount);
  if (final < 0n)
    throw new RemunerationRuleError(
      'Os descontos não podem ser maiores que o total.',
    );
  return {
    dailyTotal: fromCents(dailyTotal),
    totalAmount: fromCents(total),
    finalAmount: fromCents(final),
    totalManual: manual,
  };
}

/** Percentual com duas casas (arredondamento meio para cima); nulo se a base for ≤ 0. */
export function percentOf(part: string, base: string): string | null {
  const b = toCents(base);
  if (b <= 0n) return null;
  const scaled = (toCents(part) * 10000n * 2n + b) / (2n * b);
  return fromCents(scaled);
}
