import { api } from "@/api/http";

export type PaymentStatusFilter = "open" | "pending" | "approved" | "paid" | "cancelled";

export type ConsolidatedFilters = {
  project_id?: number;
  field_agent_id?: number;
  status?: PaymentStatusFilter;
  expected_month?: string;
  paid_month?: string;
  expected_date?: string;
  payment_date?: string;
};

export type ConsolidatedRow = {
  id: number;
  project_id: number;
  project_name: string;
  field_agent_id: number;
  field_agent_name: string;
  state: string | null;
  start_date: string;
  end_date: string;
  expected_payment_date: string | null;
  payment_date: string | null;
  days: number;
  daily_rate: string;
  additional_amount: string;
  total_amount: string;
  total_manual: boolean;
  discount_amount: string;
  final_amount: string;
  status: "pending" | "approved" | "paid" | "cancelled";
  overdue: boolean;
};

export type Facet = { total: number; options: Array<{ value: string; label: string; count: number }> };

export type Consolidated = {
  today: string;
  require_approval: boolean;
  kpis: {
    reference_month: string;
    total: string;
    paid: string;
    open: string;
    field_agents: number;
    expected_in_month: string;
    paid_in_month: string;
    open_in_month: string;
    open_next_month: string;
    overdue: string;
    overdue_count: number;
  };
  facets: Record<keyof ConsolidatedFilters, Facet>;
  summary: {
    rows: Array<{ field_agent_id: number; name: string; entries: number; days: number; final: string; paid: string; open: string }>;
    show_all: boolean;
    subtotal: { final: string; paid: string; open: string };
  };
  items: ConsolidatedRow[];
};

export type BatchResult = { done: number; failed: number; results: Array<{ id: number; ok: boolean; message?: string }> };

export const fieldAgentPaymentsApi = {
  list: (filters: ConsolidatedFilters) =>
    api.get<Consolidated>("/field-agent-payments", { params: filters }).then((r) => r.data),
  exportFile: (filters: ConsolidatedFilters) =>
    api.get<Blob>("/field-agent-payments/export", { params: filters, responseType: "blob" }).then((r) => r.data),
  pay: (payload: { ids: number[]; date_mode: "today" | "chosen" | "individual"; payment_date?: string; dates?: Record<string, string> }) =>
    api.post<BatchResult>("/field-agent-payments/pay", payload).then((r) => r.data),
  revert: (ids: number[]) => api.post<BatchResult>("/field-agent-payments/revert", { ids }).then((r) => r.data),
  changeDate: (id: number, payload: { kind: "payment" | "expected"; date: string }) =>
    api.post<{ ok: true }>(`/field-agent-payments/${id}/date`, payload).then((r) => r.data),
};

export const fieldAgentPaymentsKeys = {
  all: ["field-agent-payments"] as const,
  list: (filters: ConsolidatedFilters) => ["field-agent-payments", filters] as const,
};

export const civilBr = (value: string | null) => (value ? value.split("-").reverse().join("/") : "");
export const monthBr = (value: string) => {
  const [y, m] = value.split("-");
  return `${m}/${y}`;
};
