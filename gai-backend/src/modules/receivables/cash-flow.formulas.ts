/**
 * Fórmulas do fluxo de caixa (doc 06 §7.2–§7.4, etapa 7). Valores em centavos
 * (BigInt), datas civis AAAA-MM-DD. Nada aqui lê banco: tudo é testável à mão.
 */

export const cents = (value: string): bigint => {
  const negative = value.startsWith('-');
  const [w, f = ''] = value.replace('-', '').split('.');
  const c = BigInt(w) * 100n + BigInt(f.padEnd(2, '0').slice(0, 2));
  return negative ? -c : c;
};
export const money = (value: bigint): string => {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  return `${negative ? '-' : ''}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
};

/** Data civil + n dias. */
export function addDays(civil: string, days: number): string {
  const d = new Date(`${civil}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Data civil + n meses, com o dia limitado ao fim do mês (31/01 + 1 = 28/02). */
export function addMonths(civil: string, months: number): string {
  const [y, m, d] = civil.split('-').map(Number);
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** Último dia do mês seguinte (reembolso sem lote, doc 06 §7.2). */
export function lastDayOfNextMonth(civil: string): string {
  const [y, m] = civil.split('-').map(Number);
  return new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
}

/** Parcelas iguais: base truncada, resto na última (mesma regra dos recebíveis). */
export function splitEqual(total: string, n: number): string[] {
  const t = cents(total);
  const base = t / BigInt(n);
  return Array.from({ length: n }, (_, i) =>
    money(i === n - 1 ? t - base * BigInt(n - 1) : base),
  );
}

/** Parcelas por percentual (soma 100): meio para cima, resto na última. */
export function splitPercentages(
  total: string,
  percentages: string[],
): string[] {
  const t = cents(total);
  const parts = percentages.map((p) => (t * cents(p) * 2n + 10000n) / 20000n);
  parts[parts.length - 1] = t - parts.slice(0, -1).reduce((a, b) => a + b, 0n);
  return parts.map(money);
}

export interface ProposedInstallment {
  number: number;
  due_on: string;
  amount: string;
}

/**
 * Parcelas do contrato (doc 06 §7.2): n = parcelas do plano (padrão 1);
 * valor_i = valor × %_i / 100 (iguais: 100/n); data_i = data do contrato +
 * prazo da 1ª parcela (parâmetro) + i meses.
 */
export function contractProposal(input: {
  value: string;
  contractedOn: string;
  firstInstallmentDays: number;
  plan: {
    mode: string;
    installments: number;
    percentages?: string[] | null;
  } | null;
}): ProposedInstallment[] {
  const n = input.plan?.installments ?? 1;
  const amounts =
    input.plan?.mode === 'percentages' && input.plan.percentages?.length === n
      ? splitPercentages(input.value, input.plan.percentages)
      : splitEqual(input.value, n);
  const first = addDays(input.contractedOn, input.firstInstallmentDays);
  return amounts.map((amount, i) => ({
    number: i + 1,
    due_on: addMonths(first, i),
    amount,
  }));
}

/** Aditivo (doc 06 §7.2): valor / parcelas; 1ª em data do aditivo + prazo, depois mensal. */
export function amendmentProposal(input: {
  value: string;
  datedOn: string;
  installments: number;
  firstInstallmentDays: number;
}): ProposedInstallment[] {
  const first = addDays(input.datedOn, input.firstInstallmentDays);
  return splitEqual(input.value, Math.max(1, input.installments)).map(
    (amount, i) => ({
      number: i + 1,
      due_on: addMonths(first, i),
      amount,
    }),
  );
}

/** IR derivado de uma entrada de faturamento: valor × %IR / 100 (meio para cima; negativo no estorno). */
export function incomeTax(amount: string, pct: string): string {
  const v = cents(amount);
  const negative = v < 0n;
  const abs = negative ? -v : v;
  const r = (abs * cents(pct) * 2n + 10000n) / 20000n;
  return money(negative ? -r : r);
}

/** "reversed" = recebimento estornado: aparece só sob pedido e fica fora dos KPIs. */
export type FlowStatus = 'realized' | 'open' | 'proposed' | 'reversed';

/** Um movimento do fluxo (entrada ou saída), já com a data efetiva do fluxo. */
export interface FlowItem {
  key: string;
  direction: 'in' | 'out';
  group:
    | 'billing'
    | 'reimbursement'
    | 'other_in'
    | 'to_reimburse'
    | 'non_reimbursable';
  origin: string;
  origin_label: string;
  project_id: number | null;
  project_name: string;
  currency: string;
  /** Data no fluxo: realizada (recebido/pago em) ou prevista. */
  date: string;
  expected_on: string | null;
  realized_on: string | null;
  status: FlowStatus;
  overdue: boolean;
  overdue_days: number;
  gross: string;
  /** Entradas de faturamento: bruto − IR; demais: igual ao bruto. */
  net: string;
  /** Saída derivada (IR): não entra como "atrasada" nem tem baixa própria. */
  derived: boolean;
  installment: { number: number; of: number } | null;
  contract_pct: string | null;
  description: string;
  /** Referências para as ações (baixa, estorno, reprogramar, confirmar, pagar). */
  refs: Record<string, string | number | null>;
  /** Data do fato: data da despesa (saídas) ou data do lote (reembolsos). */
  reference_on?: string | null;
  /** Composição (itens do lote de reembolso ou das despesas a reembolsar). */
  details?: Array<{ date: string; description: string; amount: string }>;
}

interface Bucket {
  realized: bigint;
  open: bigint;
}
const add = (b: Bucket, item: FlowItem, value: bigint) => {
  if (item.status === 'realized') b.realized += value;
  else b.open += value;
};

/**
 * KPIs do fluxo (doc 06 §7.1 e §7.4), por moeda, a partir da mesma lista de
 * movimentos das tabelas (baixa manual entra; vencidas entram).
 * - Mês: (entradas recebidas + a receber) − (saídas pagas + a pagar), no mês;
 * - Próximo mês: entradas previstas líquidas de IR − saídas previstas (sem o IR,
 *   já descontado das entradas);
 * - Ano: entradas − saídas (com IR) do ano; a receber (líquido) e a pagar;
 * - Atraso: entradas e saídas em aberto com data anterior à de referência.
 */
export function cashFlowKpis(
  items: FlowItem[],
  ref: { month: string; year: string },
) {
  const next = addMonths(`${ref.month}-01`, 1).slice(0, 7);
  const currencies = [...new Set(items.map((i) => i.currency))].sort();
  return currencies.map((currency) => {
    const own = items.filter((i) => i.currency === currency);
    const month = {
      in: { realized: 0n, open: 0n },
      out: { realized: 0n, open: 0n },
    };
    const nextIn = { gross: 0n, net: 0n };
    let nextOut = 0n;
    const year = { in: 0n, out: 0n, inOpenNet: 0n, outOpen: 0n };
    const overdue = { in: 0n, inCount: 0, out: 0n, outCount: 0 };
    const proposed = { amount: 0n, count: 0 };
    for (const i of own) {
      if (i.status === 'reversed') continue;
      const v = cents(i.gross);
      const m = i.date.slice(0, 7);
      if (m === ref.month)
        add(i.direction === 'in' ? month.in : month.out, i, v);
      if (m === next && i.status !== 'realized') {
        if (i.direction === 'in') {
          nextIn.gross += v;
          nextIn.net += cents(i.net);
        } else if (i.origin !== 'income_tax') nextOut += v;
      }
      if (i.date.slice(0, 4) === ref.year) {
        if (i.direction === 'in') {
          year.in += v;
          if (i.status !== 'realized') year.inOpenNet += cents(i.net);
        } else {
          year.out += v;
          if (i.status !== 'realized' && i.origin !== 'income_tax')
            year.outOpen += v;
        }
      }
      if (i.overdue && !i.derived) {
        if (i.direction === 'in') {
          overdue.in += v;
          overdue.inCount++;
        } else {
          overdue.out += v;
          overdue.outCount++;
        }
      }
      if (i.status === 'proposed' && i.direction === 'in') {
        proposed.amount += v;
        proposed.count++;
      }
    }
    // A receber no ano: o IR das entradas abertas já sai do líquido; a pagar sem o IR.
    return {
      currency,
      month: {
        reference: ref.month,
        in_realized: money(month.in.realized),
        in_open: money(month.in.open),
        out_realized: money(month.out.realized),
        out_open: money(month.out.open),
        total: money(
          month.in.realized +
            month.in.open -
            month.out.realized -
            month.out.open,
        ),
      },
      next_month: {
        reference: next,
        in_gross: money(nextIn.gross),
        in_net: money(nextIn.net),
        out: money(nextOut),
        total: money(nextIn.net - nextOut),
      },
      year: {
        reference: ref.year,
        in: money(year.in),
        out: money(year.out),
        total: money(year.in - year.out),
        in_open_net: money(year.inOpenNet),
        out_open: money(year.outOpen),
      },
      overdue: {
        in: money(overdue.in),
        in_count: overdue.inCount,
        out: money(overdue.out),
        out_count: overdue.outCount,
      },
      proposed: { amount: money(proposed.amount), count: proposed.count },
    };
  });
}

/** Dias entre duas datas civis (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000,
  );
}
