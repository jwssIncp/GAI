import { api } from "@/api/http";

export type AssetTagRow = {
  id: number;
  project_id: number;
  project_name: string;
  proposal_number: string | null;
  ordered_on: string;
  quantity: number;
  sequence_start: number | null;
  sequence_end: number | null;
  quantity_from_sequence: boolean;
  model: string | null;
  supplier_name: string;
  unit_cost: string;
  supplier_payment_status: "pending" | "paid";
  supplier_expected_payment_on: string | null;
  supplier_paid_on: string | null;
  unit_price: string;
  client_expected_receipt_on: string | null;
  client_received: boolean;
  client_received_on: string | null;
  expense_type: "reimbursable" | "non_reimbursable" | null;
  expense_type_source: "manual" | "contract" | null;
  contract_expense_type: "reimbursable" | "non_reimbursable" | null;
  tax_pct: string | null;
  cost_total: string;
  value_total: string;
  net_value: string | null;
  net_profit: string | null;
  notes: string | null;
  updated_at: string;
};

export type AssetTagFilters = {
  project_id?: number;
  supplier_status?: "pending" | "paid";
  received?: "yes" | "no";
  expense_type?: "reimbursable" | "non_reimbursable" | "unclassified";
  proposal?: string;
};

export type AssetTagList = {
  today: string;
  parameters: { configured: boolean; tag_tax_pct: string | null; tag_models: string[] | null; default_tag_supplier: string | null };
  projects: Array<{ id: number; name: string; open: boolean }>;
  kpis: { purchased: number; supplier_pending: number; to_receive: number; cost_total: string; value_total: string; net_profit: string; missing_tax_count: number; missing_tax_since: string | null };
  totals: { count: number; quantity: number; cost_total: string; value_total: string; net_value: string; net_profit: string; missing_tax_count: number };
  items: AssetTagRow[];
};

export type AssetTagInput = Partial<{
  project_id: number;
  proposal_number: string | null;
  ordered_on: string;
  quantity: number;
  sequence_start: number | null;
  sequence_end: number | null;
  model: string | null;
  supplier_name: string;
  unit_cost: string;
  supplier_paid: boolean;
  supplier_expected_payment_on: string | null;
  supplier_paid_on: string | null;
  unit_price: string;
  client_expected_receipt_on: string | null;
  client_received: boolean;
  client_received_on: string | null;
  expense_type_override: "reimbursable" | "non_reimbursable" | null;
  notes: string | null;
}>;

export const assetTagsApi = {
  list: (filters: AssetTagFilters) => api.get<AssetTagList>("/asset-tag-orders", { params: filters }).then((r) => r.data),
  create: (payload: AssetTagInput) => api.post<{ id: number }>("/asset-tag-orders", payload).then((r) => r.data),
  update: (id: number, payload: AssetTagInput) =>
    api.patch<{ id: number; changed: string[] }>(`/asset-tag-orders/${id}`, payload).then((r) => r.data),
  remove: (id: number) => api.delete(`/asset-tag-orders/${id}`).then((r) => r.data),
};

export const assetTagsKeys = {
  all: ["asset-tags"] as const,
  list: (filters: AssetTagFilters) => ["asset-tags", filters] as const,
};

/** "0,345" ou "1.234,5" → "0.345" / "1234.5" (até 4 casas); vazio ou inválido → null. */
export function normalizeUnit(value: string): string | null {
  const raw = value.trim().replace(/\s|R\$/g, "");
  if (!raw) return null;
  const plain = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  if (!/^\d{1,11}(\.\d{1,4})?$/.test(plain)) return null;
  return plain;
}

/** "0.3450" → "R$ 0,345" (sem zeros à direita além dos centavos). */
export function unitBr(value: string): string {
  const [whole, fraction = ""] = value.split(".");
  const trimmed = fraction.replace(/0+$/, "").padEnd(2, "0");
  return `R$ ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${trimmed}`;
}

export const civilBr = (value: string | null | undefined) => (value ? value.split("-").reverse().join("/") : "");
