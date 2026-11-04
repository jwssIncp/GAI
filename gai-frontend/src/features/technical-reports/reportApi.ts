import { api } from "@/api/http";
export function selectionFrom(f: FormData): Selection {
  const n = (k: string) => String(f.get("selection." + k) ?? "");
  return {
    families: [...new Set(f.getAll("selection.families").map(String))],
    ...(n("session_id") ? { session_id: Number(n("session_id")) } : {}),
    ...(n("valuation_batch_id")
      ? { valuation_batch_id: Number(n("valuation_batch_id")) }
      : {}),
  };
}
export const reportInput = "w-full rounded-lg border bg-background p-2 text-sm";
export const familyLabels: Record<string, string> = {
  identity: "Projeto e empresa",
  units: "Unidades",
  inventory: "Inventário físico",
  accounting: "Base contábil",
  observations: "Observações da sessão",
  reconciliation: "Conciliação e consolidação",
  valuation: "Avaliações",
  issues: "Pendências",
};
export const systemFields = [
  "project.name",
  "project.id",
  "project.status",
  "company.name",
  "company.document",
  "inventory.count",
  "observations.count",
  "accounting.count",
  "reconciliation.count",
  "valuation.count",
  "valuation.used_total",
  "issues.open_count",
];
export const reportStatuses: Record<string, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  approved: "Aprovado",
  reopened: "Reaberto",
  archived: "Arquivado",
};
export type Rules = {
  responsible_required: boolean;
  professional_registration_required: boolean;
  reconciliation_required: boolean;
  valuation_required: boolean;
  unresolved_divergences: "warning" | "block";
  incomplete_indicators: "warning" | "block";
  stale_sources: "warning" | "block";
};
export type TemplateData = {
  name: string;
  report_type: string;
  description: string;
  sections: { key: string; title: string; text: string; required: boolean }[];
  fields: {
    key: string;
    label: string;
    required: boolean;
    system_key?: string;
  }[];
  tables: string[];
  rules: Rules;
};
export type Template = {
  id: number;
  revision: number;
  archived: boolean;
  publishedVersionId: number | null;
  data: TemplateData;
};
export type TemplateVersion = {
  id: number;
  revision: number;
  operation: string;
  hash: string;
  data: TemplateData;
  actorId: number;
  recordedAt: string;
  reason: string;
};
export type Responsible = {
  id: number;
  data: {
    id: number;
    user_id: number;
    display_name: string;
    function: string;
    professional_registration: string;
    registration_evidence: string;
  };
};
export type Selection = {
  families: string[];
  session_id?: number;
  valuation_batch_id?: number;
};
export type Validation = {
  engine: string;
  valid: boolean;
  source_hash: string;
  issues: {
    code: string;
    severity: "warning" | "block";
    message: string;
    key?: string;
  }[];
};
export type Content = {
  title: string;
  template: {
    id: number;
    version_id: number;
    hash: string;
    data: TemplateData;
  };
  sections: {
    key: string;
    title: string;
    text: string;
    origin: "template" | "manual";
  }[];
  fields: {
    key: string;
    label: string;
    value: string;
    origin: "system" | "manual" | "empty";
    source_key: string | null;
    original_value: string | null;
  }[];
  responsibles: Responsible["data"][];
  technical_notes: string;
  conclusion: string;
  sources: {
    selection: Selection;
    generated_at: string;
    hash: string;
    permissions: string[];
    tables: {
      family: string;
      columns: string[];
      rows: (string | number | boolean | null)[][];
      hash: string;
      references: { id: number; version: string }[];
    }[];
    fields: Record<string, string | null>;
    metrics: Record<string, string | number | null>;
    missing: string[];
    unresolved: number | null;
  };
};
export type Version = {
  id: number;
  revision: number;
  status: string;
  hash: string;
  actorId: number;
  recordedAt: string;
  reason: string;
  validation: Validation;
  data: Content;
};
export type Report = {
  id: number;
  projectId: number;
  revision: number;
  status: string;
  approvedVersionId: number | null;
  data: Content;
  versions: Omit<Version, "data" | "validation">[];
};
export type ReportRow = Pick<
  Report,
  "id" | "projectId" | "revision" | "status" | "approvedVersionId"
> & { title: string; report_type: string };
const base = (p: number) => `/projects/${p}/technical-reports`;
export const reportApi = {
  templates: async (p: number) =>
    (await api.get<Template[]>(base(p) + "/templates")).data,
  template: async (p: number, id: number) =>
    (
      await api.get<{ template: Template; versions: TemplateVersion[] }>(
        base(p) + "/templates/" + id,
      )
    ).data,
  saveTemplate: async (p: number, id: number | undefined, d: object) =>
    (id
      ? await api.put<Template>(base(p) + "/templates/" + id, d)
      : await api.post<Template>(base(p) + "/templates", d)
    ).data,
  templateAction: async (p: number, id: number, action: string, d: object) =>
    (await api.post<Template>(base(p) + `/templates/${id}/${action}`, d)).data,
  responsibles: async (p: number) =>
    (await api.get<Responsible[]>(base(p) + "/responsibles")).data,
  responsible: async (p: number, d: object) =>
    (await api.post<Responsible>(base(p) + "/responsibles", d)).data,
  list: async (p: number) => (await api.get<ReportRow[]>(base(p))).data,
  create: async (p: number, d: object) =>
    (await api.post<Report>(base(p), d)).data,
  detail: async (p: number, id: number) =>
    (await api.get<Report>(base(p) + "/" + id)).data,
  save: async (p: number, id: number, d: object) =>
    (await api.put<Report>(base(p) + "/" + id, d)).data,
  refresh: async (p: number, id: number, d: object) =>
    (await api.post<Report>(base(p) + `/${id}/refresh-sources`, d)).data,
  validate: async (p: number, id: number) =>
    (await api.get<Validation>(base(p) + `/${id}/validation`)).data,
  transition: async (p: number, id: number, d: object) =>
    (await api.post<Report>(base(p) + `/${id}/transitions`, d)).data,
  version: async (p: number, id: number, v: number) =>
    (await api.get<Version>(base(p) + `/${id}/versions/${v}`)).data,
  download: async (p: number, id: number, v: number) => {
    const r = await api.get<Blob>(base(p) + `/${id}/versions/${v}/export`, {
        responseType: "blob",
      }),
      url = URL.createObjectURL(r.data),
      a = document.createElement("a");
    a.href = url;
    a.download = `laudo-${id}-versao-${v}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
export function emptyTemplate(): TemplateData {
  return {
    name: "",
    report_type: "Relatório patrimonial",
    description: "",
    sections: [
      {
        key: "identificacao",
        title: "Identificação",
        text: "Projeto: {{projeto}}",
        required: true,
      },
      { key: "objetivo", title: "Objetivo e escopo", text: "", required: true },
      {
        key: "consideracoes",
        title: "Considerações técnicas e limitações",
        text: "",
        required: false,
      },
    ],
    fields: [
      {
        key: "projeto",
        label: "Projeto",
        required: true,
        system_key: "project.name",
      },
    ],
    tables: ["identity"],
    rules: {
      responsible_required: true,
      professional_registration_required: false,
      reconciliation_required: false,
      valuation_required: false,
      unresolved_divergences: "warning",
      incomplete_indicators: "warning",
      stale_sources: "block",
    },
  };
}
