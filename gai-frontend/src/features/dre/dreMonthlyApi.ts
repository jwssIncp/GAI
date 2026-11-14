import { api } from "@/api/http";

export type DreCell = {
  month: string;
  value: string;
  flow: string;
  entered: string | null;
  classified: string;
  estimate: string | null;
  estimate_basis: string | null;
  closed: boolean;
};
export type DreGridAccount = {
  id: number;
  code: string;
  name: string;
  group: string;
  post_operational: boolean;
  role: string | null;
  flow_kinds: string[];
  cells: DreCell[];
  total: string;
};
export type DreLine = { key: string; label: string; values: string[]; total: string };
export type DreGrid = {
  year: string;
  months: string[];
  current_month: string;
  cutoff: string;
  accounts: DreGridAccount[];
  lines: DreLine[];
  estimates: number;
  month_state: Array<{ month: string; closed: boolean; projected: boolean; automatic: boolean }>;
  window: Record<string, unknown>;
  warnings: string[];
};
export type DreLayout = { hidden: number[]; summary: number[]; post_operational: number[] };
export type DreMonthlyView =
  | { configured: false; as_of: string }
  | {
      configured: true;
      as_of: string;
      grid: DreGrid;
      compare: {
        year: string;
        lines: Array<{ key: string; total: string; values: string[] }>;
        accounts: Array<{ id: number; total: string; values: string[] }>;
      } | null;
      config: {
        rules: Record<string, number>;
        rule_labels: Record<string, string>;
        flow_kinds: string[];
        layout: { revision: number; data: DreLayout };
        accounts: Array<{ id: number; label: string; name: string; group: string; revision: number }>;
        excluded_accounts: Array<{ id: number; code: string; name: string; revision: number }>;
      };
    };
export type DreCellDetail = {
  account: { id: number; code: string; name: string };
  month: string;
  cell: DreCell;
  versions: Array<{ revision: number; amount: string | null; origin: string; reason: string; recorded_at: string }>;
  movements: Array<{ date: string; description: string; project_name: string; status: string; gross: string; sign: number }>;
  movements_hidden: boolean;
};
export type DreImportPlan = {
  year: string;
  file_name: string;
  checksum: string;
  mapping: Record<string, number>;
  rows: Array<{
    line: number;
    label: string;
    status: string;
    account_id: number | null;
    account_label: string | null;
    months: Array<{ month: string; amount: string | null; current: string | null; action: string }>;
  }>;
  totals: { apply: number; skipped_closed: number; skipped_flow: number; unmatched: number };
  accounts: Array<{ id: number; label: string }>;
};

const key = () => crypto.randomUUID();
const base = "/finance/dre/monthly";
const form = (o: Record<string, string | undefined>, file: File) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) if (v !== undefined) f.append(k, v);
  f.append("file", file);
  return f;
};

export const dreMonthlyApi = {
  view: (q: { year: string; compare_year?: string }) =>
    api.get<DreMonthlyView>(base, { params: q }).then((r) => r.data),
  detail: (account_id: number, month: string) =>
    api.get<DreCellDetail>(`${base}/detail`, { params: { account_id, month } }).then((r) => r.data),
  setCell: (account_id: number, month: string, amount: string | null, reason: string) =>
    api.put(`${base}/cells`, { command_key: key(), reason, account_id, month, amount }).then((r) => r.data),
  saveRules: (rules: Record<string, number | null>, reason: string) =>
    api.put(`${base}/rules`, { command_key: key(), reason, rules }).then((r) => r.data),
  saveLayout: (revision: number, layout: DreLayout, reason: string) =>
    api.put(`${base}/layout`, { command_key: key(), reason, revision, ...layout }).then((r) => r.data),
  setAccountActive: (id: number, revision: number, name: string, active: boolean, reason: string) =>
    api.put(`/finance/dre/accounts/${id}`, { command_key: key(), reason, revision, name, active }).then((r) => r.data),
  preview: (year: string, file: File, mapping: Record<string, number>) =>
    api
      .post<DreImportPlan>(`${base}/imports/preview`, form({ year, mapping: JSON.stringify(mapping) }, file))
      .then((r) => r.data),
  confirm: (year: string, file: File, mapping: Record<string, number>, checksum: string, reason: string) =>
    api
      .post<{ written: number }>(
        `${base}/imports`,
        form({ year, mapping: JSON.stringify(mapping), checksum, reason, command_key: key() }, file),
      )
      .then((r) => r.data),
};

export const dreMonthlyKeys = {
  all: ["dre-monthly"] as const,
  view: (q: { year: string; compare_year?: string }) => ["dre-monthly", q] as const,
};

/** "-1.234,56" → "-1234.56"; vazio → null; inválido → undefined. */
export function parseSignedMoney(raw: string): string | null | undefined {
  const s = raw.trim().replace(/R\$\s?/i, "").replace(/\s/g, "");
  if (!s) return null;
  const negative = s.startsWith("-");
  const body = (negative ? s.slice(1) : s).replace(/\./g, "").replace(",", ".");
  if (!/^\d{1,13}(\.\d{1,2})?$/.test(body)) return undefined;
  return `${negative ? "-" : ""}${Number(body).toFixed(2)}`;
}
export const monthLabel = (m: string) => {
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;
};

export type DreChecklist =
  | { month: string; legacy: true; message: string }
  | {
      month: string;
      cutoff: string;
      automatic: boolean;
      blockers: Array<{ code: string; message: string }>;
      warnings: Array<{ code: string; message: string; count: number; amount: string | null }>;
    };
export type DreFreezePreview = {
  month: string;
  revision: number;
  lines: Array<{ key: string; label: string; stored: string | null; recalculated: string; difference: string | null }>;
  accounts: Array<{ id: number; code: string; name: string; value: string }>;
};
export type DreReviewEntry = {
  id: number;
  revision: number;
  description: string;
  source: string;
  project_id: number | null;
  months: string[];
  amount: string;
};
export type DreModelPlan = {
  version: string;
  accounts: Array<{ code: string; name: string; group: string; synthetic: boolean; action: "create" | "exists" | "conflict"; note: string | null }>;
  rules: Array<{ kind: string; code: string; action: "map" | "kept" | "skip" }>;
  post_operational: Array<{ code: string; action: "mark" | "kept" }>;
  totals: { create: number; exists: number; conflict: number; map: number };
};

export const dreClosingApi = {
  checklist: (month: string) => api.get<DreChecklist>(`${base}/checklist/${month}`).then((r) => r.data),
  freezePreview: (month: string) => api.get<DreFreezePreview>(`${base}/freeze/${month}`).then((r) => r.data),
  freeze: (month: string, revision: number, reason: string) =>
    api.post(`${base}/freeze/${month}`, { command_key: key(), reason, revision }).then((r) => r.data),
  review: () => api.get<DreReviewEntry[]>(`${base}/review`).then((r) => r.data),
  voidReviewed: (id: number, revision: number, reason: string) =>
    api.post(`${base}/review/${id}/void`, { command_key: key(), reason, revision }).then((r) => r.data),
  modelPreview: () => api.get<DreModelPlan>(`${base}/model`).then((r) => r.data),
  modelApply: (reason: string) =>
    api.post<{ created: number; mapped: number; post_operational_marked: number; conflicts: number }>(`${base}/model`, { command_key: key(), reason }).then((r) => r.data),
};
