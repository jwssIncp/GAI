import { api } from "@/api/http";

export type FixedCostItemMode = "average_3_months" | "fixed" | "zero";
export type CommercialOrigin = { code: string; label: string; commission_pct: string };

/** Mesmo formato validado pela API (decimais como texto com ponto). */
export type FinanceSettingsValues = {
  income_tax_pct: string;
  tag_tax_pct: string;
  default_daily_rate: string;
  budget_productivity_items_per_day: number;
  budgeted_non_reimbursable_expense_pct: string;
  technician_expense_alert_pct: string;
  commercial_origins: CommercialOrigin[];
  partner_commission_pct: string;
  fixed_cost_operation: string;
  fixed_cost_branch: string;
  fixed_cost_item_modes: {
    additional_income_tax: FixedCostItemMode;
    equipment: FixedCostItemMode;
    back_office: FixedCostItemMode;
  };
  /** Valor mensal de cada item; obrigatório (> 0) quando o modo é "fixo". */
  fixed_cost_item_amounts: {
    additional_income_tax: string;
    equipment: string;
    back_office: string;
  };
  economic_break_even_margin_pct: string;
  first_installment_days_after_contract: number;
  dre_regime_cutoff_month: string;
  expense_reasons: string[];
  tag_models: string[];
  default_tag_supplier: string;
  field_agent_document_max_bytes: number;
  expense_attachment_max_bytes: number;
  expense_attachment_max_files: number;
  require_approval: boolean;
};

export type FinanceSettingsVersion = {
  id: number;
  organization_id: number;
  version: number;
  valid_from: string;
  values: FinanceSettingsValues;
  reason: string;
  actor_id: number | null;
  actor_name: string | null;
  recorded_at: string;
};

export type FinanceSettingsOverview = {
  organization_id: number;
  today: string;
  /** Data do lançamento financeiro mais antigo da organização (sugestão de vigência). */
  earliest_fact_date: string | null;
  /** Início da versão mais antiga; antes dele, nenhum parâmetro vigente. */
  coverage_start: string | null;
  current: FinanceSettingsVersion | null;
  scheduled: FinanceSettingsVersion | null;
  versions: FinanceSettingsVersion[];
  platform_max_upload_bytes: number;
};

export const financeSettingsApi = {
  overview: () =>
    api.get<FinanceSettingsOverview>("/finance-settings").then((r) => r.data),
  defaults: () =>
    api.get<FinanceSettingsValues>("/finance-settings/defaults").then((r) => r.data),
  publish: (payload: { valid_from: string; reason: string; values: FinanceSettingsValues }) =>
    api.post<FinanceSettingsVersion>("/finance-settings", payload).then((r) => r.data),
};

export const financeSettingsKeys = { all: ["finance-settings"] as const };

export const FIXED_COST_MODE_LABEL: Record<FixedCostItemMode, string> = {
  average_3_months: "Média dos últimos 3 meses",
  fixed: "Valor fixo",
  zero: "Não considerar",
};

/** Próxima data de início permitida: hoje, ou o dia seguinte à última vigência. */
/** Há lançamentos sem parâmetro vigente (antes da primeira versão, ou nenhuma versão)? */
export function uncoveredSince(overview: FinanceSettingsOverview): string | null {
  const first = overview.earliest_fact_date;
  if (!first) return null;
  return !overview.coverage_start || first < overview.coverage_start ? first : null;
}

/** Endereço para publicar uma versão retroativa a partir de uma data (links dos avisos). */
export const retroactiveSettingsUrl = (date: string) => `/app/finance/parameters?valid_from=${date}`;

export function nextValidFrom(overview: FinanceSettingsOverview): string {
  const latest = overview.versions.reduce<string | null>(
    (max, version) => (max === null || version.valid_from > max ? version.valid_from : max),
    null,
  );
  if (!latest || latest < overview.today) return overview.today;
  const next = new Date(`${latest}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}
