/**
 * Fórmulas das placas de patrimônio (doc 06 §5.2). Valores unitários com até
 * 4 casas (placa pode custar R$ 0,345); totais arredondados para centavos
 * (meio para cima). Tudo em inteiros (BigInt), sem ponto flutuante.
 */

export class AssetTagRuleError extends Error {}

const UNIT = /^\d{1,11}(\.\d{1,4})?$/;
const PCT = /^\d{1,3}(\.\d{1,2})?$/;

/** "0.345" → 3450 (décimos de milésimo de real). */
export function toUnits(value: string): bigint {
  if (typeof value !== 'string' || !UNIT.test(value))
    throw new AssetTagRuleError(
      'Valor unitário deve usar ponto decimal e até quatro casas.',
    );
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, '0'));
}

/** Centavos → "1234.56" (aceita negativo). */
export function centsToMoney(value: bigint): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  return `${negative ? '-' : ''}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
}

/** Arredonda décimos de milésimo (1/10000) para centavos, meio para cima. */
const unitsToCents = (units: bigint) =>
  units >= 0n ? (units + 50n) / 100n : -((-units + 50n) / 100n);

/**
 * Quantidade pela sequência: com sequência válida (final ≥ inicial > 0),
 * qtd = final − inicial + 1 e o campo quantidade fica só leitura.
 * Sequência final < inicial é sinalizada (erro).
 */
export function sequenceQuantity(
  start: number | null | undefined,
  end: number | null | undefined,
): { quantity: number | null; error: string | null } {
  if (start == null || end == null) return { quantity: null, error: null };
  if (!Number.isInteger(start) || !Number.isInteger(end) || start <= 0)
    return {
      quantity: null,
      error: 'Sequência deve ter números inteiros positivos.',
    };
  if (end < start)
    return {
      quantity: null,
      error: 'A sequência final é menor que a inicial.',
    };
  return { quantity: end - start + 1, error: null };
}

export interface AssetTagTotals {
  cost_total: string;
  value_total: string;
  /** Nulo sem % de impostos vigente nos parâmetros (não inventa 16%). */
  net_value: string | null;
  net_profit: string | null;
}

/**
 * custo_total = qtd × custo unitário; valor_total = qtd × valor unitário;
 * valor_líquido = valor_total × (1 − %impostos/100); lucro = líquido − custo.
 */
export function assetTagTotals(input: {
  quantity: number;
  unitCost: string;
  unitPrice: string;
  taxPct: string | null;
}): AssetTagTotals {
  if (!Number.isInteger(input.quantity) || input.quantity < 0)
    throw new AssetTagRuleError('Quantidade deve ser um inteiro não negativo.');
  const qty = BigInt(input.quantity);
  const cost = unitsToCents(qty * toUnits(input.unitCost));
  const value = unitsToCents(qty * toUnits(input.unitPrice));
  if (input.taxPct === null)
    return {
      cost_total: centsToMoney(cost),
      value_total: centsToMoney(value),
      net_value: null,
      net_profit: null,
    };
  if (!PCT.test(input.taxPct))
    throw new AssetTagRuleError('Percentual de impostos inválido.');
  const [w, f = ''] = input.taxPct.split('.');
  const basisPoints = BigInt(w) * 100n + BigInt(f.padEnd(2, '0')); // 16.00 → 1600
  if (basisPoints > 10000n)
    throw new AssetTagRuleError('Percentual de impostos acima de 100%.');
  // value (centavos) × (10000 − bp) / 10000, meio para cima
  const net = (value * (10000n - basisPoints) * 2n + 10000n) / 20000n;
  return {
    cost_total: centsToMoney(cost),
    value_total: centsToMoney(value),
    net_value: centsToMoney(net),
    net_profit: centsToMoney(net - cost),
  };
}

/** Tipo de despesa das placas: "Plaquetas por conta de" do contrato; a alteração manual prevalece. */
export function assetTagExpenseType(
  payers: Array<string | null | undefined>,
  override: string | null | undefined,
): 'reimbursable' | 'non_reimbursable' | null {
  if (override === 'reimbursable' || override === 'non_reimbursable')
    return override;
  const set = new Set(payers.filter(Boolean));
  if (set.size !== 1) return null;
  return set.has('client')
    ? 'reimbursable'
    : set.has('company')
      ? 'non_reimbursable'
      : null;
}

/** Ano digitado com 2 dígitos ("0026-05-10") vira 2026; outras datas inválidas são recusadas. */
export function normalizeCivilDate(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined || value === '') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new AssetTagRuleError('Data inválida (use AAAA-MM-DD).');
  let year = Number(match[1]);
  if (year < 100) year += 2000;
  const iso = `${String(year).padStart(4, '0')}-${match[2]}-${match[3]}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || !date.toISOString().startsWith(iso))
    throw new AssetTagRuleError('Data inválida.');
  return iso;
}

/**
 * Regra de "recebido" / "pago" com data (doc 06 §5.2): data preenchida → sim;
 * marcar sim sem data → hoje; marcar não → limpa a data.
 */
export function settlementDate(
  flag: boolean | undefined,
  date: string | null | undefined,
  current: string | null,
  today: string,
): string | null {
  if (date !== undefined) {
    const normalized = normalizeCivilDate(date);
    if (normalized) return normalized;
    if (flag === true) return today;
    return null;
  }
  if (flag === true) return current ?? today;
  if (flag === false) return null;
  return current;
}
