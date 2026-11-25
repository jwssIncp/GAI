import type { RemunerationItem } from "./remunerationApi";

const cents = (value: string) => {
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = value.replace("-", "").split(".");
  const abs = BigInt(whole || "0") * 100n + BigInt((fraction + "00").slice(0, 2));
  return negative ? -abs : abs;
};
const fromCents = (value: bigint) => {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  return `${negative ? "-" : ""}${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`;
};

/** Próximo dia de segunda a sexta depois da data (AAAA-MM-DD). */
export function nextWeekday(date: string): string {
  const next = new Date(`${date}T00:00:00Z`);
  do next.setUTCDate(next.getUTCDate() + 1);
  while (next.getUTCDay() === 0 || next.getUTCDay() === 6);
  return next.toISOString().slice(0, 10);
}

export type RemunerationAgentGroup = {
  field_agent_id: number;
  name: string;
  state: string | null;
  /** Lançamentos do inventariante, do período mais antigo ao mais recente. */
  items: RemunerationItem[];
  /** Lançamentos que contam (cancelados fora). */
  active: number;
  /** Início do trabalho: menor data inicial entre os lançamentos que contam. */
  first_start: string | null;
  /** Fim do último período lançado. */
  last_end: string | null;
  /** Data real do último pagamento feito. */
  last_payment: string | null;
  /** Diária do lançamento mais recente (sugestão para o próximo). */
  last_daily_rate: string | null;
  /** Primeiro dia útil depois do último período (sugestão para o próximo). */
  next_start: string | null;
  final_amount: string;
  paid_amount: string;
  open_amount: string;
};

/**
 * Agrupa os lançamentos por inventariante, para ver o histórico no mesmo lugar: início do
 * trabalho, último período, último pagamento e saldos. Cada pagamento continua sendo um
 * lançamento próprio (filtros por data, baixa e mês fechado seguem por lançamento).
 */
export function groupByAgent(items: RemunerationItem[]): RemunerationAgentGroup[] {
  const groups = new Map<number, RemunerationItem[]>();
  for (const item of items) {
    const list = groups.get(item.field_agent_id) ?? [];
    list.push(item);
    groups.set(item.field_agent_id, list);
  }
  return [...groups.values()]
    .map((list) => {
      const sorted = [...list].sort(
        (a, b) => a.start_date.localeCompare(b.start_date) || a.id - b.id,
      );
      const counted = sorted.filter((item) => item.status !== "cancelled");
      const last = counted[counted.length - 1] ?? null;
      const lastEnd = counted.reduce<string | null>(
        (max, item) => (!max || item.end_date > max ? item.end_date : max),
        null,
      );
      const lastPayment = counted.reduce<string | null>(
        (max, item) =>
          item.status === "paid" && item.payment_date && (!max || item.payment_date > max)
            ? item.payment_date
            : max,
        null,
      );
      const sum = (filter: (item: RemunerationItem) => boolean) =>
        fromCents(counted.filter(filter).reduce((total, item) => total + cents(item.final_amount), 0n));
      return {
        field_agent_id: sorted[0].field_agent_id,
        name: sorted[0].field_agent_name,
        state: last?.state ?? sorted[sorted.length - 1].state,
        items: sorted,
        active: counted.length,
        first_start: counted[0]?.start_date ?? null,
        last_end: lastEnd,
        last_payment: lastPayment,
        last_daily_rate: last?.daily_rate ?? null,
        next_start: lastEnd ? nextWeekday(lastEnd) : null,
        final_amount: sum(() => true),
        paid_amount: sum((item) => item.status === "paid"),
        open_amount: sum((item) => item.status === "pending" || item.status === "approved"),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
