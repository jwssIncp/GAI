import { api } from "@/api/http";
export { money, cls } from "@/features/receivables/financeApi";
export const groups: Record<string, string> = {
  revenue: "Receitas",
  deductions: "Deduções",
  direct_cost: "Custos diretos",
  operating_expense: "Despesas operacionais",
  financial_income: "Receitas financeiras",
  financial_expense: "Despesas financeiras",
  income_tax: "Tributos sobre lucro reconhecidos",
};
export type Scope = Record<string, string>;
export const scope = (p: URLSearchParams, project = true) =>
  Object.fromEntries(
    ["organization_id", ...(project ? ["project_id"] : [])].flatMap((k) =>
      p.get(k) ? [[k, p.get(k)!]] : [],
    ),
  );
export type Account = {
  id: number;
  code: string;
  revision: number;
  data: {
    name: string;
    group: string;
    parent_id: number | null;
    posting: boolean;
    active: boolean;
  };
};
export type Source = {
  kind: string;
  id: number | null;
  key: string | null;
  project_id: number | null;
  amount: string | null;
  remaining_amount?: string;
  currency: string | null;
  description: string;
  hint_date: string | null;
  entry_id?: number | null;
  recognition_status?: string;
};
export type Allocation = {
  month: string;
  amount: string;
  account: {
    id: number;
    revision: number;
    name: string;
    group: string;
    code: string;
    path: string[];
  } | null;
};
export type EntryData = {
  economic_key: string;
  event_document: string;
  description: string;
  currency: string;
  currency_reason: string;
  status: string;
  source: Source;
  allocations: Allocation[];
};
export type Entry = {
  id: number;
  organizationId: number;
  projectId: number | null;
  revision: number;
  data: EntryData;
  versions?: {
    id: number;
    revision: number;
    data: EntryData;
    hash: string;
    reason: string;
    actorId: number;
    recordedAt: string;
  }[];
};
export type Line = {
  key: string;
  label: string;
  amount: string | null;
  known_amount: string;
  complete: boolean;
  entry_ids: number[];
  groups: string[];
};
export type Calculated = {
  currency: string;
  lines: Line[];
  complete: boolean;
  gross_margin: string | null;
  operating_margin: string | null;
  known_gross_margin: string | null;
  known_operating_margin: string | null;
  unclassified_amount: string;
};
export type Row = {
  entry_id: number;
  revision: number;
  month: string;
  currency: string;
  project_id: number | null;
  amount: string;
  group: string | null;
  account_code: string | null;
  account_name: string | null;
  description: string;
  source_key: string | null;
};
export type Report = {
  organization_id: number;
  filters: Record<string, unknown>;
  source_permissions: string[];
  generated_at: string;
  periods: unknown[];
  entry_versions: unknown[];
  engine_version: string;
  complete: boolean;
  totals: Calculated[];
  monthly: (Calculated & { month: string; closed: boolean })[];
  by_project: (Calculated & { project_id: number | null })[];
  rows: Row[];
  pending_sources: Source[];
  unclassified: {
    entry_id: number;
    account_code: string | null;
    month: string;
    currency: string;
    amount: string;
    reason: string;
  }[];
  stale_sources: Source[];
  warnings: string[];
  comparison: {
    start_month: string;
    end_month: string;
    totals: Calculated[];
  } | null;
};
export type Period = {
  id: number;
  month: string;
  revision: number;
  closed: boolean;
  data: {
    currency: string;
    policy_reference: string;
    reviewed_groups: string[];
    sources_reviewed: boolean;
    hash: string;
    snapshot: { complete: boolean };
  };
};
const base = "/finance/dre";
export const dreApi = {
  accounts: async (f: Scope) =>
    (await api.get<Account[]>(base + "/accounts", { params: f })).data,
  account: async (id: number) =>
    (
      await api.get<{
        account: Account;
        versions: {
          revision: number;
          data: Account["data"];
          reason: string;
          actorId: number;
          recordedAt: string;
        }[];
      }>(base + "/accounts/" + id)
    ).data,
  createAccount: async (d: object, f: Scope) =>
    (await api.post<Account>(base + "/accounts", d, { params: f })).data,
  editAccount: async (id: number, d: object, f: Scope) =>
    (await api.put<Account>(base + "/accounts/" + id, d, { params: f })).data,
  bootstrap: async (d: object, f: Scope) =>
    (await api.post(base + "/accounts/bootstrap", d, { params: f })).data,
  sources: async (f: Scope) =>
    (
      await api.get<{ items: Source[]; total: number; note: string }>(
        base + "/sources",
        { params: f },
      )
    ).data,
  entries: async (f: Scope) =>
    (
      await api.get<{ items: Entry[]; total: number }>(base + "/entries", {
        params: f,
      })
    ).data,
  entry: async (id: number) =>
    (await api.get<Entry>(base + "/entries/" + id)).data,
  saveEntry: async (id: number | undefined, d: object, f: Scope) =>
    (id
      ? await api.put<Entry>(base + "/entries/" + id, d, { params: f })
      : await api.post<Entry>(base + "/entries", d, { params: f })
    ).data,
  report: async (f: Scope) =>
    (await api.get<Report>(base + "/report", { params: f })).data,
  periods: async (f: Scope) =>
    (await api.get<Period[]>(base + "/periods", { params: f })).data,
  period: async (month: string, f: Scope) =>
    (
      await api.get<{
        period: Period | null;
        history: {
          id: number;
          operation: string;
          reason: string;
          actorId: number;
          recordedAt: string;
        }[];
      }>(base + "/periods/" + month, { params: f })
    ).data,
  close: async (month: string, d: object, f: Scope) =>
    (
      await api.post<Period>(base + "/periods/" + month + "/close", d, {
        params: f,
      })
    ).data,
  reopen: async (month: string, d: object, f: Scope) =>
    (
      await api.post<Period>(base + "/periods/" + month + "/reopen", d, {
        params: f,
      })
    ).data,
  export: async (kind: string, f: Scope) =>
    (
      await api.post<{ id: number; status: string }>(base + "/exports", {
        ...f,
        kind,
      })
    ).data,
  exportStatus: async (id: number) =>
    (
      await api.get<{ status: string; error_message?: string }>(
        base + "/exports/" + id,
      )
    ).data,
  download: async (id: number) => {
    const r = await api.get<Blob>(base + "/exports/" + id + "/download", {
        responseType: "blob",
      }),
      u = URL.createObjectURL(r.data),
      a = document.createElement("a");
    a.href = u;
    a.download = `dre-gerencial-${id}.xlsx`;
    a.click();
    URL.revokeObjectURL(u);
  },
};
