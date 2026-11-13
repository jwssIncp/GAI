import { api } from "@/api/http";

export type RemunerationStatus = "pending" | "approved" | "paid" | "cancelled";
export type RemunerationStatusGroup = "open" | "paid" | "cancelled" | "all";

export type RemunerationParameters = {
  settings_missing: boolean;
  default_daily_rate: string | null;
  require_approval: boolean | null;
  technician_expense_alert_pct: string | null;
};

export type RemunerationItem = {
  id: number;
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
  daily_total: string;
  total_amount: string;
  total_manual: boolean;
  discount_amount: string;
  final_amount: string;
  status: RemunerationStatus;
  notes: string | null;
  reopened_at: string | null;
  updated_at: string;
};

export type ProjectRemuneration = {
  project: { id: number; name: string; status: string };
  parameters: RemunerationParameters;
  agents: Array<{ id: number; name: string; state: string | null; link_status: string; has_payments: boolean }>;
  to_launch: Array<{ field_agent_id: number; name: string; state: string | null }>;
  items: RemunerationItem[];
  totals: { count: number; total_amount: string; discount_amount: string; final_amount: string };
  kpis: { total_final: string; paid_final: string };
};

export type RemunerationProjectRow = {
  id: number;
  name: string;
  status: string;
  status_label: string;
  technicians: number;
  contract_value: string;
  non_reimbursable_expenses: string | null;
  net_contract_value: string | null;
  agents_cost: string;
  technician_pct: string | null;
  technician_pct_alert: boolean;
  net_pct: string | null;
  net_pct_alert: boolean;
  scope: string[];
  segment: string | null;
  state: string | null;
  contracted_on: string | null;
  finished_at: string | null;
};

export type RemunerationProjects = {
  parameters: RemunerationParameters;
  items: RemunerationProjectRow[];
  subtotal_agents_cost: string;
};

export type RemunerationInput = {
  field_agent_id: number;
  state?: string | null;
  start_date: string;
  end_date: string;
  expected_payment_date: string;
  daily_rate: string;
  additional_amount: string;
  total_manual: boolean;
  total_amount?: string | null;
  discount_amount: string;
  notes?: string | null;
};

export type RemunerationFilters = {
  field_agent_id?: number;
  state?: string;
  status_group?: RemunerationStatusGroup;
};

const base = (projectId: number) => `/projects/${projectId}`;

export const remunerationApi = {
  project: (projectId: number, filters: RemunerationFilters) =>
    api.get<ProjectRemuneration>(`${base(projectId)}/remuneration`, { params: filters }).then((r) => r.data),
  exportFile: (projectId: number, filters: RemunerationFilters) =>
    api
      .get<Blob>(`${base(projectId)}/remuneration/export`, { params: filters, responseType: "blob" })
      .then((r) => r.data),
  projects: (params: { search?: string; only_open?: boolean; year?: number }) =>
    api
      .get<RemunerationProjects>("/remuneration/projects", {
        params: { ...params, only_open: params.only_open ? "true" : undefined },
      })
      .then((r) => r.data),
  create: (projectId: number, payload: RemunerationInput) =>
    api.post(`${base(projectId)}/payments`, payload).then((r) => r.data),
  update: (projectId: number, id: number, payload: RemunerationInput) =>
    api.patch(`${base(projectId)}/payments/${id}`, payload).then((r) => r.data),
  approve: (projectId: number, id: number) =>
    api.post(`${base(projectId)}/payments/${id}/approve`).then((r) => r.data),
  markAsPaid: (projectId: number, id: number, payment_date?: string) =>
    api
      .post(`${base(projectId)}/payments/${id}/mark-as-paid`, payment_date ? { payment_date } : {})
      .then((r) => r.data),
  cancel: (projectId: number, id: number) =>
    api.post(`${base(projectId)}/payments/${id}/cancel`).then((r) => r.data),
  reopen: (projectId: number, id: number, reason: string) =>
    api.post(`${base(projectId)}/payments/${id}/reopen`, { reason }).then((r) => r.data),
  remove: (projectId: number, id: number) =>
    api.delete(`${base(projectId)}/payments/${id}`).then((r) => r.data),
};

export const remunerationKeys = {
  all: ["remuneration"] as const,
  project: (projectId: number, filters: RemunerationFilters) =>
    ["remuneration", "project", projectId, filters] as const,
  projects: (params: object) => ["remuneration", "projects", params] as const,
};

export const statusLabel: Record<RemunerationStatus, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  paid: "Pago",
  cancelled: "Cancelado",
};

// ---------- Fórmulas (iguais às da API, em centavos inteiros) ----------

const MONEY = /^\d{1,13}(\.\d{1,2})?$/;

/** "1.234,56" ou "1234.56" → "1234.56"; vazio → "0.00"; inválido → null. */
export function normalizeMoney(value: string): string | null {
  const raw = value.trim().replace(/\s/g, "");
  if (!raw) return "0.00";
  const plain = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  if (!MONEY.test(plain)) return null;
  const [whole, fraction = ""] = plain.split(".");
  return `${Number(whole)}.${fraction.padEnd(2, "0")}`;
}

const cents = (value: string) => {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
};
const fromCents = (value: bigint) => {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  return `${negative ? "-" : ""}${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`;
};

/** dias = fim − início + 1 (conta os dois extremos); 0 se as datas estiverem incompletas ou invertidas. */
export function daysInclusive(start: string, end: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return 0;
  const days = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
  return days > 0 ? days : 0;
}

/** total = dias × diária + adicional (ou o manual); final = total − descontos. */
export function computeRemuneration(input: {
  days: number;
  dailyRate: string;
  additional: string;
  discount: string;
  manualTotal?: string | null;
}) {
  const daily = BigInt(input.days) * cents(input.dailyRate);
  const total = input.manualTotal != null ? cents(input.manualTotal) : daily + cents(input.additional);
  const final = total - cents(input.discount);
  return { dailyTotal: fromCents(daily), total: fromCents(total), final: fromCents(final), negative: final < 0n };
}

/** Exibição com vírgula decimal. */
export const decimalBr = (value: string) => value.replace(".", ",");

/** "1415.00" → "1.415,00" (milhar com ponto, decimal com vírgula), para campos de valor. */
export function moneyBr(value: string): string {
  if (!value) return "";
  const [whole, fraction = "00"] = value.split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${fraction.padEnd(2, "0").slice(0, 2)}`;
}
