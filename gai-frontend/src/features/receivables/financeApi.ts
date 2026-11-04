import { api } from "@/api/http";
export type Filters = Record<string, string>;
export type Payment = {
  mode: string;
  count: number;
  first_due_on: string;
  entry_amount?: string;
  entry_due_on?: string;
  amounts?: string[];
  percentages?: string[];
  dates?: string[];
};
export type ReceivableInput = {
  organization_id?: number;
  company_id: number;
  project_id?: number;
  origin: string;
  source_id?: number;
  description: string;
  amount: string;
  currency: string;
  issued_on: string;
  document?: string;
  notes?: string;
  reason: string;
  payment: Payment;
};
export type Installment = {
  id: number;
  position: number;
  kind: string;
  dueOn: string;
  amount: string;
  received: string;
  open: string;
  status: string;
  overdue: boolean;
};
export type Event = {
  id: number;
  operation: string;
  amount: string | null;
  effectiveOn: string | null;
  installmentId: number | null;
  reversesId: number | null;
  actorId: number;
  recordedAt: string;
  details: Record<string, unknown>;
};
export type Receivable = {
  id: number;
  organizationId: number;
  companyId: number;
  projectId: number | null;
  contractId: number | null;
  sourceKey: string | null;
  amount: string;
  currency: string;
  revision: number;
  cancelled: boolean;
  data: ReceivableInput;
  received: string;
  open: string;
  status: string;
  overdue: boolean;
  installments: Installment[];
  events: Event[];
};
export type Preview = {
  preview_hash: string;
  data: ReceivableInput;
  plan: {
    rows: { position: number; kind: string; due_on: string; amount: string }[];
  };
};
export type Metrics = {
  currency: string;
  expected_in: string;
  expected_out: string;
  actual_in: string;
  actual_out: string;
  overdue: string;
  actual_net: string;
  projected_net: string;
};
export type Movement = {
  source: string;
  source_id: number;
  receivable_id: number | null;
  company_id: number;
  project_id: number | null;
  currency: string;
  direction: string;
  view: string;
  on: string;
  amount: string;
  description: string;
};
export type CashReport = {
  totals: Metrics[];
  monthly: (Metrics & { month: string })[];
  by_client: (Metrics & { company_id: number })[];
  by_project: (Metrics & { project_id: number | null })[];
  movements: Movement[];
  limitations: string[];
  undated_expenses: number;
  undated_payments: number;
  definitions: Record<string, string>;
};
export const statusLabels: Record<string, string> = {
  open: "Em aberto",
  partial: "Parcial",
  paid: "Quitado",
  cancelled: "Cancelado",
  overdue: "Vencido",
};
export const financeApi = {
  list: async (f: Filters) =>
    (
      await api.get<{
        items: Receivable[];
        total: number;
        page: number;
        page_size: number;
      }>("/finance/receivables", { params: f })
    ).data,
  detail: async (id: string) =>
    (await api.get<Receivable>("/finance/receivables/" + id)).data,
  source: async (kind: string, id: string) =>
    (await api.get<Partial<ReceivableInput>>(`/finance/sources/${kind}/${id}`))
      .data,
  preview: async (d: ReceivableInput) =>
    (await api.post<Preview>("/finance/receivables/preview", d)).data,
  create: async (
    d: ReceivableInput,
    preview_hash: string,
    command_key: string,
  ) =>
    (
      await api.post<Receivable>("/finance/receivables", {
        ...d,
        preview_hash,
        command_key,
      })
    ).data,
  command: async (id: string, action: string, body: object) =>
    (await api.post<Receivable>(`/finance/receivables/${id}/${action}`, body))
      .data,
  edit: async (id: string, body: object) =>
    (await api.put<Receivable>(`/finance/receivables/${id}`, body)).data,
  cash: async (f: Filters) =>
    (await api.get<CashReport>("/finance/cash-flow", { params: f })).data,
  export: async (kind: string, filters: Filters) =>
    (
      await api.post<{ id: number; status: string }>("/finance/exports", {
        kind,
        filters,
      })
    ).data,
  exportStatus: async (id: number) =>
    (
      await api.get<{
        id: number;
        status: string;
        error_message: string | null;
      }>(`/finance/exports/${id}`)
    ).data,
  download: async (id: number) => {
    const r = await api.get<Blob>(`/finance/exports/${id}/download`, {
      responseType: "blob",
    });
    const u = URL.createObjectURL(r.data),
      a = document.createElement("a");
    a.href = u;
    a.download = `financeiro-${id}.xlsx`;
    a.click();
    URL.revokeObjectURL(u);
  },
};
export function money(value: string, currency: string) {
  const negative = value.startsWith("-"),
    [whole, fraction = "00"] = (negative ? value.slice(1) : value).split(".");
  const exact = `${negative ? "-" : ""}${new Intl.NumberFormat("pt-BR").format(BigInt(whole))},${fraction.padEnd(2, "0")}`;
  if (currency === "UNSPECIFIED") return `${exact} (moeda não informada)`;
  const symbol = new Intl.NumberFormat("pt-BR", { style: "currency", currency })
    .formatToParts(0)
    .find((p) => p.type === "currency")!.value;
  return `${symbol} ${exact}`;
}
export const today = () => new Date().toISOString().slice(0, 10);
export const cls = "w-full rounded-lg border bg-background p-2 text-sm";
