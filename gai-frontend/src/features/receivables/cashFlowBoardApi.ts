import { api } from "@/api/http";

export type FlowItem = {
  key: string;
  direction: "in" | "out";
  group: "billing" | "reimbursement" | "other_in" | "to_reimburse" | "non_reimbursable";
  origin: string;
  origin_label: string;
  project_id: number | null;
  project_name: string;
  currency: string;
  date: string;
  expected_on: string | null;
  realized_on: string | null;
  /** "reversed" = recebimento estornado (escondido por padrão, fora dos KPIs). */
  status: "realized" | "open" | "proposed" | "reversed";
  overdue: boolean;
  overdue_days: number;
  gross: string;
  net: string;
  derived: boolean;
  installment: { number: number; of: number } | null;
  contract_pct: string | null;
  description: string;
  refs: Record<string, string | number | null>;
};

export type CashFlowKpis = {
  currency: string;
  month: { reference: string; in_realized: string; in_open: string; out_realized: string; out_open: string; total: string };
  next_month: { reference: string; in_gross: string; in_net: string; out: string; total: string };
  /** total = fluxo do ano; dre_total = resultado final da DRE mensal jan–dez (etapa 9). */
  year: { reference: string; in: string; out: string; total: string; in_open_net: string; out_open: string; dre_total?: string | null };
  overdue: { in: string; in_count: number; out: string; out_count: number };
  proposed: { amount: string; count: number };
};

export type CashFlowBoard = {
  as_of: string;
  reference: { month: string; year: string };
  kpis: CashFlowKpis[];
  alerts: {
    proposed_count: number;
    proposed_amount: string;
    missing_parameters_since: string | null;
    missing_tax_count: number;
    undated_payments: number;
    unproposed_contracts: Array<{ source_key: string; reason: string }>;
  };
  projects: Array<{ id: number; name: string }>;
  items: FlowItem[];
};

export type BoardQuery = { project_id?: number; year?: string; month?: string };
export type BatchResult = { done: number; failed: number; results: Array<{ key: string; ok: boolean; message?: string }> };
type InstallmentRef = { receivable_id: number; installment_id: number };

const post = <T,>(path: string, body: object) => api.post<T>(`/finance/cash-flow${path}`, body).then((r) => r.data);

export const cashFlowApi = {
  board: (q: BoardQuery) => api.get<CashFlowBoard>("/finance/cash-flow/board", { params: q }).then((r) => r.data),
  confirm: (keys: string[]) => post<BatchResult>("/proposals/confirm", { keys }),
  discard: (keys: string[], reason: string) => post<BatchResult>("/proposals/discard", { keys, reason }),
  receive: (items: InstallmentRef[], received_on: string) => post<BatchResult>("/receipts", { items, received_on }),
  undoReceipts: (items: Array<{ receivable_id: number; event_id: number }>) => post<BatchResult>("/receipts/undo", { items }),
  reschedule: (items: InstallmentRef[], due_on: string, reason: string) => post<BatchResult>("/reschedule", { items, due_on, reason }),
  settle: (keys: string[], paid_on: string | null) => post<BatchResult>("/outflows/settle", { keys, paid_on }),
};

export const cashFlowKeys = {
  all: ["cash-flow-board"] as const,
  board: (q: BoardQuery) => ["cash-flow-board", q] as const,
};

export const civilBr = (value: string | null | undefined) => (value ? value.split("-").reverse().join("/") : "");
export const monthBr = (value: string) => value.split("-").reverse().join("/");

export type FixedCostItem = { key: string; label: string; mode: string; amount: string | null; available: boolean };
export type CashFlowIndicatorValues = {
  window: { from: string; to: string; revenue: string; months_with_revenue: number; missing_accounts: string[] };
  contribution_margin: {
    mc: string;
    mce: string;
    income_tax_pct: string;
    field_agents_pct: string;
    non_reimbursable_pct: string;
    commission_pct: string;
    partner_effective_pct: string;
  } | null;
  fixed_cost: { items: FixedCostItem[]; total: string; year: string; unavailable: string[] };
  dre: { year: string; revenue: string; operating_result: string; final_result: string; estimates: number; cash_flow_total: string };
  operating_result: string;
  partner_commission: { pct: string; quarters: string[]; operating_by_quarter: string[]; year: string; account_missing: boolean };
  projected_result: string;
  year_revenue: string;
  accounting_break_even: string | null;
  economic_break_even: string | null;
  economic_margin_pct: string;
  net_margin: string | null;
  average_collection_days: string | null;
  collection_since: string;
  notes: string[];
};
export type SaleSimulationInput = { value: string; signal_month: string; second_month: string; third_month: string; company_expenses: boolean };
export type CashFlowIndicators =
  | { configured: false; as_of: string; reference: { month: string; year: string } }
  | {
      configured: true;
      as_of: string;
      reference: { month: string; year: string };
      kpis: CashFlowKpis;
      indicators: CashFlowIndicatorValues;
      simulation: null | {
        input: SaleSimulationInput;
        basis: { field_agents_pct: string; non_reimbursable_pct: string; mc: string; year_sale: string; sale_result: string; client_share: string };
        movements: Array<{ date: string; direction: "in" | "out"; origin: string; gross: string }>;
        kpis: CashFlowKpis;
        indicators: CashFlowIndicatorValues;
        delta: { month_total: string; next_month_total: string; year_total: string; projected_result: string };
      };
    };

export const indicatorsApi = {
  get: (q: BoardQuery, sim: SaleSimulationInput | null) =>
    api
      .get<CashFlowIndicators>("/finance/cash-flow/indicators", {
        params: {
          ...q,
          ...(sim
            ? {
                sim_value: sim.value,
                sim_signal_month: sim.signal_month,
                sim_second_month: sim.second_month,
                sim_third_month: sim.third_month,
                sim_company_expenses: String(sim.company_expenses),
              }
            : {}),
        },
      })
      .then((r) => r.data),
};
export const indicatorsKeys = {
  get: (q: BoardQuery, sim: SaleSimulationInput | null) => ["cash-flow-board", "indicators", q, sim] as const,
};

/** "10.000,50" → "10000.50"; inválido → null. */
export const parseBrMoney = (raw: string): string | null => {
  const s = raw.trim().replace(/\./g, "").replace(",", ".");
  return /^\d{1,13}(\.\d{1,2})?$/.test(s) && Number(s) > 0 ? Number(s).toFixed(2) : null;
};
