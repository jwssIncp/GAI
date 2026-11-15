import { api } from "@/api/http";

export type CommissionStatus = "paid" | "overdue" | "pending";
export const COMMISSION_STATUS_LABEL: Record<CommissionStatus, string> = {
  paid: "Pago",
  overdue: "Atrasado",
  pending: "Pendente",
};

export type CommissionRow = {
  id: number;
  project_id: number;
  project_name: string;
  contract_id: number | null;
  partner_id: number;
  partner_name: string;
  contract_value: string;
  percent: string;
  calculated_amount: string;
  amount_manual: string | null;
  amount: string;
  expected_payment_on: string | null;
  paid_on: string | null;
  status: CommissionStatus;
  notes: string | null;
  updated_at: string;
};

export type Partner = { id: number; name: string; company: string | null; label: string; commissions?: number };

export type CommissionList = {
  today: string;
  kpis: { total: string; paid: string; pending: string; overdue: string; overdue_count: number };
  totals: { count: number; contract_value: string; amount: string };
  projects: Array<{ id: number; name: string; open: boolean; contract_value: string | null }>;
  partners: Partner[];
  items: CommissionRow[];
};

export type CommissionFilters = { project_id?: number; partner_id?: number; status?: CommissionStatus };

export type CommissionInput = Partial<{
  project_id: number;
  partner_id: number;
  contract_value: string;
  percent: string;
  amount_manual: string | null;
  expected_payment_on: string | null;
  paid_on: string | null;
  notes: string | null;
}>;

export const commissionsApi = {
  list: (filters: CommissionFilters) => api.get<CommissionList>("/commissions", { params: filters }).then((r) => r.data),
  create: (payload: CommissionInput) => api.post<{ id: number }>("/commissions", payload).then((r) => r.data),
  update: (id: number, payload: CommissionInput) =>
    api.patch<{ id: number; changed: string[] }>(`/commissions/${id}`, payload).then((r) => r.data),
  remove: (id: number) => api.delete(`/commissions/${id}`).then((r) => r.data),
  partners: () => api.get<Partner[]>("/commission-partners").then((r) => r.data),
  createPartner: (payload: { name: string; company: string | null }) =>
    api.post<{ id: number; label: string }>("/commission-partners", payload).then((r) => r.data),
  removePartner: (id: number) => api.delete(`/commission-partners/${id}`).then((r) => r.data),
};

export const commissionsKeys = {
  all: ["commissions"] as const,
  list: (filters: CommissionFilters) => ["commissions", filters] as const,
  partners: ["commissions", "partners"] as const,
};

/** comissão = valor × % / 100 (meio para cima), a mesma regra da API. */
export function commissionAmount(value: string, percent: string): string | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value) || !/^\d{1,3}(\.\d{1,2})?$/.test(percent)) return null;
  const c = (v: string) => {
    const [w, f = ""] = v.split(".");
    return BigInt(w) * 100n + BigInt(f.padEnd(2, "0"));
  };
  const r = (c(value) * c(percent) * 2n + 10000n) / 20000n;
  return `${r / 100n}.${String(r % 100n).padStart(2, "0")}`;
}

/** "4,5" / "4.5" → "4.50"; inválido → null. */
export function normalizePercent(value: string): string | null {
  const raw = value.trim().replace("%", "").replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(raw) || Number(raw) > 100) return null;
  const [w, f = ""] = raw.split(".");
  return `${Number(w)}.${f.padEnd(2, "0")}`;
}

export const pctBr = (value: string) => `${value.replace(".", ",")}%`;
export const civilBr = (value: string | null | undefined) => (value ? value.split("-").reverse().join("/") : "");
