import { api } from "@/api/http";

export type ExpenseType = "reimbursable" | "non_reimbursable";
export type ExpensePaymentMethod = "cash" | "installments" | "invoiced";
export type ExpenseStatus = "pending" | "approved" | "paid" | "rejected" | "cancelled";

export const EXPENSE_TYPE_LABEL: Record<ExpenseType, string> = {
  reimbursable: "Reembolsável",
  non_reimbursable: "Não reembolsável",
};
export const PAYMENT_METHOD_LABEL: Record<ExpensePaymentMethod, string> = {
  cash: "À vista",
  installments: "A prazo",
  invoiced: "Faturado",
};
export const EXPENSE_STATUS_LABEL: Record<ExpenseStatus, string> = {
  pending: "Pendente",
  approved: "Aprovada",
  paid: "Paga",
  rejected: "Rejeitada",
  cancelled: "Cancelada",
};

export type ExpenseProjectRow = {
  id: number;
  name: string;
  status: string;
  status_label: string;
  contract_value: string;
  to_reimburse: string;
  reimbursable: string;
  non_reimbursable: string;
  unclassified_count: number;
  expenses_count: number;
  contract_pct: string | null;
  contract_pct_alert: boolean;
  finance_closed: boolean;
  scope: string[];
};

export type ExpenseProjects = {
  items: ExpenseProjectRow[];
  total_to_reimburse: string;
  subtotal_to_reimburse: string;
};

export type Installment = { number: number; due_date: string; amount: string };

export type ExpenseBoardItem = {
  id: number;
  sequence: number | null;
  expense_type: ExpenseType | null;
  expense_type_label: string;
  contract_type_label: string;
  reason_code: string | null;
  description: string;
  legacy_reason: string | null;
  expense_date: string;
  field_agent_id: number | null;
  field_agent_name: string;
  payment_method: ExpensePaymentMethod | null;
  payment_method_label: string;
  installments: Installment[];
  invoiced_payment_date: string | null;
  attachments: number;
  amount: string;
  deposited_amount: string | null;
  balance: string | null;
  status: ExpenseStatus;
  rejection_reason: string | null;
  batch: { id: number; number: number; status: string; batch_date: string } | null;
  to_reimburse: boolean;
  reopened_at: string | null;
  updated_at: string;
};

export type ExpenseBoard = {
  project: { id: number; name: string; status: string };
  today: string;
  closure: { closed_at: string; closed_by: string | null; reason: string } | null;
  parameters: {
    configured: boolean;
    reasons: string[] | null;
    attachment_max_bytes: number | null;
    attachment_max_files: number | null;
  };
  default_expense_type: ExpenseType | null;
  contract_type_label: string;
  kpis: {
    total: string;
    count: number;
    reimbursable: string;
    reimbursable_pct: string | null;
    non_reimbursable: string;
    non_reimbursable_pct: string | null;
    unclassified: string;
    unclassified_count: number;
    to_reimburse: string;
    contract_value: string;
    contract_pct: string | null;
  };
  summary: Array<{
    field_agent_id: number | null;
    name: string;
    entries: number;
    advances: string;
    advances_count: number;
    expenses: string;
    balance: string;
  }>;
  agents: Array<{ id: number; name: string; linked: boolean }>;
  items: ExpenseBoardItem[];
  totals: { count: number; amount: string; non_reimbursable_amount: string };
};

export type ExpenseBoardFilters = {
  expense_type?: ExpenseType | "unclassified";
  billing?: "billed" | "pending";
  status?: ExpenseStatus;
  start_date?: string;
  end_date?: string;
  field_agent_id?: string;
  search?: string;
  batch_id?: number;
};

export type ReimbursementBatch = {
  id: number;
  number: number;
  batch_date: string;
  expected_receipt_on: string | null;
  status: "open" | "billed" | "received" | "cancelled";
  status_label: string;
  receivable_id: number | null;
  notes: string | null;
  count: number;
  amount: string;
  billed_at: string | null;
};

export type ExpenseAdvance = {
  id: number;
  field_agent_id: number;
  field_agent_name: string;
  advanced_on: string;
  amount: string;
  notes: string | null;
  deposited_by_name: string | null;
};

export type BatchResult = { done: number; failed: number; results: Array<{ id: number; ok: boolean; message?: string }> };

export type ExpensePayload = {
  field_agent_id: number | null;
  description: string;
  reason_code: string | null;
  expense_type: ExpenseType | null;
  expense_date: string;
  amount: string;
  deposited_amount: string | null;
  payment_method: ExpensePaymentMethod;
  installment_count?: number;
  installments?: Array<{ due_date: string; amount: string }>;
  invoiced_payment_date: string | null;
};

export type ImportRowValues = {
  expense_date: string | null;
  field_agent_id: number | null;
  field_agent_name: string | null;
  reason_code: string | null;
  description: string | null;
  expense_type: ExpenseType | null;
  amount: string | null;
  deposited_amount: string | null;
  payment_method: ExpensePaymentMethod | null;
  installment_count: number | null;
  invoiced_payment_date: string | null;
};
export type ImportPreview = {
  file_name: string;
  columns: Record<string, string>;
  ignored_columns: string[];
  rows: Array<{ line: number; values: ImportRowValues; errors: string[] }>;
  valid: number;
  invalid: number;
};

const base = (projectId: number) => `/projects/${projectId}`;

export const expensesApi = {
  projects: (params: { search?: string; only_open?: boolean; year?: number }) =>
    api.get<ExpenseProjects>("/expense-projects", { params }).then((r) => r.data),
  board: (projectId: number, filters: ExpenseBoardFilters) =>
    api.get<ExpenseBoard>(`${base(projectId)}/expense-board`, { params: filters }).then((r) => r.data),
  batches: (projectId: number) =>
    api.get<ReimbursementBatch[]>(`${base(projectId)}/reimbursement-batches`).then((r) => r.data),
  advances: (projectId: number) =>
    api.get<ExpenseAdvance[]>(`${base(projectId)}/expense-advances`).then((r) => r.data),
  create: (projectId: number, payload: ExpensePayload) =>
    api.post(`${base(projectId)}/expenses`, payload).then((r) => r.data as { id: number }),
  update: (projectId: number, id: number, payload: ExpensePayload) =>
    api.patch(`${base(projectId)}/expenses/${id}`, payload).then((r) => r.data as { id: number }),
  action: (projectId: number, id: number, action: "approve" | "mark-as-paid" | "cancel") =>
    api.post(`${base(projectId)}/expenses/${id}/${action}`, {}).then((r) => r.data),
  reject: (projectId: number, id: number, reason: string) =>
    api.post(`${base(projectId)}/expenses/${id}/reject`, { reason }).then((r) => r.data),
  reopen: (projectId: number, id: number, reason: string) =>
    api.post(`${base(projectId)}/expenses/${id}/reopen`, { reason }).then((r) => r.data),
  changeType: (projectId: number, ids: number[], expense_type: ExpenseType) =>
    api.post<BatchResult>(`${base(projectId)}/expense-board/type`, { ids, expense_type }).then((r) => r.data),
  remove: (projectId: number, ids: number[]) =>
    api.post<BatchResult>(`${base(projectId)}/expense-board/delete`, { ids }).then((r) => r.data),
  addToBatch: (projectId: number, payload: { ids: number[]; batch_id?: number; batch_date?: string }) =>
    api
      .post<BatchResult & { batch_id: number; batch_number: number }>(`${base(projectId)}/reimbursement-batches`, payload)
      .then((r) => r.data),
  removeFromBatch: (projectId: number, batchId: number, ids: number[]) =>
    api.post<BatchResult>(`${base(projectId)}/reimbursement-batches/${batchId}/remove`, { ids }).then((r) => r.data),
  batchAction: (projectId: number, batchId: number, action: "bill" | "reopen" | "cancel", body: object = {}) =>
    api.post(`${base(projectId)}/reimbursement-batches/${batchId}/${action}`, body).then((r) => r.data),
  closeFinance: (projectId: number, reason: string) =>
    api.post(`${base(projectId)}/finance-closure/close`, { reason }).then((r) => r.data),
  reopenFinance: (projectId: number, reason: string) =>
    api.post(`${base(projectId)}/finance-closure/reopen`, { reason }).then((r) => r.data),
  saveAdvance: (
    projectId: number,
    id: number | null,
    payload: { field_agent_id: number; advanced_on: string; amount: string; notes: string | null; deposited_by_name: string | null },
  ) =>
    (id
      ? api.patch(`${base(projectId)}/expense-advances/${id}`, payload)
      : api.post(`${base(projectId)}/expense-advances`, payload)
    ).then((r) => r.data),
  removeAdvance: (projectId: number, id: number) =>
    api.delete(`${base(projectId)}/expense-advances/${id}`).then((r) => r.data),
  exportFile: (projectId: number, filters: ExpenseBoardFilters, format: "xlsx" | "csv") =>
    api
      .get<Blob>(`${base(projectId)}/expense-board/export`, { params: { ...filters, format }, responseType: "blob" })
      .then((r) => r.data),
  zip: (projectId: number, kind: "full" | "client", batch: string) =>
    api
      .get<Blob>(`${base(projectId)}/expense-board/zip`, { params: { kind, batch }, responseType: "blob", timeout: 0 })
      .then((r) => r.data),
  importPreview: (projectId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<ImportPreview>(`${base(projectId)}/expense-board/import/preview`, form).then((r) => r.data);
  },
  importCommit: (projectId: number, rows: Array<{ line: number; values: ImportRowValues }>) =>
    api
      .post<{ done: number; failed: number; results: Array<{ line: number; ok: boolean; message?: string }> }>(
        `${base(projectId)}/expense-board/import`,
        { rows },
      )
      .then((r) => r.data),
};

export const expensesKeys = {
  all: ["expenses-parity"] as const,
  projects: (params: object) => ["expenses-parity", "projects", params] as const,
  board: (projectId: number, filters: object) => ["expenses-parity", "board", projectId, filters] as const,
  batches: (projectId: number) => ["expenses-parity", "batches", projectId] as const,
  advances: (projectId: number) => ["expenses-parity", "advances", projectId] as const,
};

/** Baixa um arquivo gerado pela API. */
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export const civilBr = (value: string | null | undefined) => (value ? value.split("-").reverse().join("/") : "");
export const pctBr = (value: string | null) => (value === null ? "—" : `${value.replace(".", ",")}%`);

/** Parcelas iguais (D-E): cota arredondada, resto na última, vencimentos +1…n meses (mesma regra da API). */
export function equalInstallments(amount: string, count: number, purchaseDate: string): Installment[] {
  if (!/^\d+(\.\d{1,2})?$/.test(amount) || !count || count < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) return [];
  const [whole, fraction = ""] = amount.split(".");
  const total = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  const n = BigInt(count);
  const share = (total * 2n + n) / (2n * n);
  const last = total - share * (n - 1n);
  if (share <= 0n || last <= 0n) return [];
  const cents = (v: bigint) => `${v / 100n}.${String(v % 100n).padStart(2, "0")}`;
  const [y, m, d] = purchaseDate.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const index = y * 12 + (m - 1) + i + 1;
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return {
      number: i + 1,
      due_date: `${year}-${String(month).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`,
      amount: cents(i === count - 1 ? last : share),
    };
  });
}
