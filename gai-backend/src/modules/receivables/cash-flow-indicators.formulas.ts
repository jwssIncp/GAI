/**
 * Indicadores do fluxo de caixa (doc 06 §7.4, etapa 8). Inteiros (BigInt):
 * valores em centavos; percentuais em décimos de milésimo de ponto
 * (13,33% = 133300). Arredondamento meio para cima só no fim.
 */
import { cents, money } from './cash-flow.formulas';

/** 1% = 10.000 unidades (4 casas decimais no percentual). */
export const PCT_UNIT = 10_000n;
const HUNDRED = 100n * PCT_UNIT;

const div = (a: bigint, b: bigint): bigint => {
  if (b === 0n) throw new Error('divisão por zero');
  const negative = a < 0n !== b < 0n;
  const x = a < 0n ? -a : a;
  const y = b < 0n ? -b : b;
  const q = (x * 2n + y) / (2n * y);
  return negative ? -q : q;
};

/** "13.33" → 133300. */
export const pctUnits = (value: string): bigint => {
  const [w, f = ''] = value.split('.');
  return BigInt(w) * PCT_UNIT + BigInt(f.padEnd(4, '0').slice(0, 4));
};
/** 605030 → "60.50" (2 casas, meio para cima). */
export const pctText = (units: bigint): string => {
  const c = div(units, 100n);
  const negative = c < 0n;
  const abs = negative ? -c : c;
  return `${negative ? '-' : ''}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
};

/** parte / base em unidades de percentual; nulo se a base for zero. */
export const ratio = (part: string, base: string): bigint | null => {
  const b = cents(base);
  return b === 0n ? null : div(cents(part) * HUNDRED, b);
};

export interface MarginInput {
  revenue: string;
  /** Valor de IR da janela; ignorado se `incomeTaxPct` vier. */
  incomeTax?: string;
  /** % de IR do parâmetro (como o INVESTOR: pctLiq). */
  incomeTaxPct?: string;
  fieldAgents: string;
  nonReimbursable: string;
  commissions: string;
  partnerPct: string;
}

/**
 * Margem de contribuição (doc 06 §7.4), com os percentuais da janela sobre a
 * receita bruta: MC = 100 − %IR − %Inventariantes − %NãoReemb − %Comissão −
 * %Sócio × (1 − %IR/100); MCe = MC + %NãoReemb. Sem receita na janela: nulo.
 */
export function contributionMargin(i: MarginInput) {
  if (cents(i.revenue) === 0n) return null;
  const ir =
    i.incomeTaxPct !== undefined
      ? pctUnits(i.incomeTaxPct)
      : ratio(i.incomeTax ?? '0.00', i.revenue)!;
  const agents = ratio(i.fieldAgents, i.revenue)!;
  const nonReimb = ratio(i.nonReimbursable, i.revenue)!;
  const commission = ratio(i.commissions, i.revenue)!;
  const partner = div(pctUnits(i.partnerPct) * (HUNDRED - ir), HUNDRED);
  const mc = HUNDRED - ir - agents - nonReimb - commission - partner;
  return {
    units: {
      mc,
      mce: mc + nonReimb,
      fieldAgents: agents,
      nonReimbursable: nonReimb,
    },
    income_tax_pct: pctText(ir),
    field_agents_pct: pctText(agents),
    non_reimbursable_pct: pctText(nonReimb),
    commission_pct: pctText(commission),
    partner_effective_pct: pctText(partner),
    mc: pctText(mc),
    mce: pctText(mc + nonReimb),
  };
}

export type FixedCostMode = 'fixed' | 'average_3_months' | 'zero';

/**
 * Custo fixo mensal: UMA função para o detalhamento e para os cards (o
 * INVESTOR calculava de dois jeitos). Operação e filial vêm dos parâmetros;
 * os itens em "média de 3 meses" dependem da DRE (etapa 9) e ficam
 * indisponíveis, explícitos — nunca um zero silencioso (adicional de IR).
 */
export function fixedCostMonthly(p: {
  operation: string;
  branch: string;
  modes: Record<string, FixedCostMode>;
  amounts: Record<string, string>;
  /** Média de 3 meses da DRE por item (nulo = sem conta associada na DRE). */
  averages?: Record<string, string | null>;
}) {
  const LABEL: Record<string, string> = {
    additional_income_tax: 'Adicional de IR',
    equipment: 'Equipamentos e licenças',
    back_office: 'Back-office',
  };
  const items = [
    {
      key: 'operation',
      label: 'Custo fixo da operação',
      mode: 'fixed',
      amount: money(cents(p.operation)),
      available: true,
    },
    {
      key: 'branch',
      label: 'Custo fixo da filial',
      mode: 'fixed',
      amount: money(cents(p.branch)),
      available: true,
    },
    ...Object.keys(LABEL).map((key) => {
      const mode = p.modes[key] ?? 'zero';
      return mode === 'fixed'
        ? {
            key,
            label: LABEL[key],
            mode,
            amount: money(cents(p.amounts[key] ?? '0.00')),
            available: true,
          }
        : mode === 'zero'
          ? { key, label: LABEL[key], mode, amount: '0.00', available: true }
          : p.averages?.[key] != null
            ? {
                key,
                label: LABEL[key],
                mode,
                amount: money(cents(p.averages[key])),
                available: true,
              }
            : {
                key,
                label: LABEL[key],
                mode,
                amount: null as string | null,
                available: false,
              };
    }),
  ];
  const total = items.reduce(
    (s, i) => s + (i.amount ? cents(i.amount) : 0n),
    0n,
  );
  return {
    items,
    total: money(total),
    unavailable: items.filter((i) => !i.available).map((i) => i.key),
  };
}

/**
 * Ponto de equilíbrio contábil (doc 06 §7.4): falta = max(0, −resultado) /
 * (MCe/100); 0 = "atingido". MCe ≤ 0: indefinido (nulo).
 */
export function accountingBreakEven(
  result: string,
  mceUnits: bigint,
): string | null {
  if (mceUnits <= 0n) return null;
  const r = cents(result);
  return money(r >= 0n ? 0n : div(-r * HUNDRED, mceUnits));
}

/**
 * Ponto de equilíbrio econômico: R = max(0, (margem% × receitaAno − resultado)
 * / ((MCe − margem%)/100)). MCe ≤ margem%: indefinido.
 */
export function economicBreakEven(
  result: string,
  yearRevenue: string,
  marginPct: string,
  mceUnits: bigint,
): string | null {
  const m = pctUnits(marginPct);
  if (mceUnits - m <= 0n) return null;
  const numerator = div(cents(yearRevenue) * m, HUNDRED) - cents(result);
  return money(numerator <= 0n ? 0n : div(numerator * HUNDRED, mceUnits - m));
}

/**
 * Margem líquida: resultado / (receita bruta − não reembolsáveis / (1 − %IR)).
 * (O INVESTOR usava 0,8667 fixo; aqui é 1 − %IR dos parâmetros.)
 */
export function netMargin(
  result: string,
  revenue: string,
  nonReimbursable: string,
  incomeTaxPct: string,
): string | null {
  const keep = HUNDRED - pctUnits(incomeTaxPct);
  if (keep <= 0n) return null;
  const grossedUp = div(cents(nonReimbursable) * HUNDRED, keep);
  const base = cents(revenue) - grossedUp;
  if (base <= 0n) return null;
  return pctText(div(cents(result) * HUNDRED, base));
}

/** Prazo médio de recebimento: Σ(valor × dias contrato→recebimento) / Σ valor (1 casa). */
export function averageCollectionDays(
  receipts: Array<{
    amount: string;
    contracted_on: string;
    received_on: string;
  }>,
): string | null {
  let weighted = 0n;
  let total = 0n;
  for (const r of receipts) {
    const days = BigInt(
      Math.round(
        (Date.parse(`${r.received_on}T00:00:00Z`) -
          Date.parse(`${r.contracted_on}T00:00:00Z`)) /
          86_400_000,
      ),
    );
    weighted += cents(r.amount) * days;
    total += cents(r.amount);
  }
  if (total === 0n) return null;
  const tenths = div(weighted * 10n, total);
  return `${tenths / 10n}.${(tenths < 0n ? -tenths : tenths) % 10n}`;
}

/** Comissão do sócio: % × resultado operacional, por trimestre, só quando positivo. */
export function partnerCommission(
  operatingByQuarter: string[],
  partnerPct: string,
) {
  const pct = pctUnits(partnerPct);
  const quarters = operatingByQuarter.map((op) => {
    const v = cents(op);
    return money(v > 0n ? div(v * pct, HUNDRED) : 0n);
  });
  return { quarters, year: money(quarters.reduce((s, q) => s + cents(q), 0n)) };
}

/** valor × % (unidades de 1e-4 ponto), meio para cima. */
export const pctOf = (amount: string, units: bigint): string =>
  money(div(cents(amount) * units, HUNDRED));

/**
 * Efeito de uma venda simulada no resultado do ano (SIM_RES do INVESTOR):
 * venda do ano × MC/100 + (se as despesas são do cliente) venda do ano ×
 * %não reembolsáveis/100 — a parte que não sai do caixa da empresa.
 */
export function saleResult(i: {
  yearSale: string;
  clientPaysExpenses: boolean;
  mcUnits: bigint;
  nonReimbursableUnits: bigint;
}) {
  const margin = pctOf(i.yearSale, i.mcUnits);
  const client = i.clientPaysExpenses
    ? pctOf(i.yearSale, i.nonReimbursableUnits)
    : '0.00';
  return {
    result: money(cents(margin) + cents(client)),
    client_share: client,
  };
}
