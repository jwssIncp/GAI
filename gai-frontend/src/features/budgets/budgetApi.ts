import { api } from "@/api/http";
export const budgetStatuses: Record<string, string> = {
  draft: "Rascunho",
  review: "Em revisão",
  approved: "Aprovado",
  rejected: "Rejeitado",
  archived: "Arquivado",
};
export const pricingNumbers = [
  ["productivity", "Produtividade diária por profissional", 1, 1000000],
  ["default_days", "Dias disponíveis", 1, 3650],
  ["default_professionals", "Equipe mínima configurada", 1, 500],
  ["addresses_per_person_day", "Endereços por profissional-dia", 1, 10000],
  ["room_capacity", "Pessoas por quarto", 1, 10],
  ["extra_every_days", "Intervalo para dias extras", 1, 3650],
  ["extra_days", "Dias extras por intervalo", 0, 31],
] as const;
export const pricingMoney = [
  ["daily_rate", "Diária técnica"],
  ["operational_fixed", "Despesas operacionais fixas"],
  ["travel_fixed", "Deslocamento fixo"],
  ["transport_per_day", "Transporte por dia"],
  ["lodging_per_room_day", "Hospedagem por quarto-dia"],
  ["food_per_person_day", "Alimentação por pessoa-dia"],
  ["materials_fixed", "Materiais"],
  ["tags_per_asset", "Plaqueta por bem"],
  ["administration_fixed", "Custo administrativo"],
  ["minimum_price", "Preço mínimo"],
] as const;
export const pricingRates = [
  ["tax_pct", "Impostos (%)"],
  ["commission_pct", "Comissão (%)"],
  ["margin_pct", "Margem alvo (%)"],
  ["address_factor", "Fator de esforço por endereço"],
] as const;
export type PricingValues = Record<(typeof pricingNumbers)[number][0], number> &
  Record<
    (typeof pricingMoney)[number][0] | (typeof pricingRates)[number][0],
    string
  > & { currency: string };
export interface Pricing {
  id: number;
  organizationId: number;
  name: string;
  version: number;
  validFrom: string;
  validTo: string;
  values: PricingValues;
  reason: string;
  actorId: number;
  recordedAt: string;
}
export interface Sizing {
  available_days?: number;
  team?: number;
  productivity?: number;
  margin_pct?: string;
  operational_extra?: string;
  final_price?: string;
  adjustment_reason?: string;
}
export interface PaymentInput {
  mode: string;
  count: number;
  first_due_on: string;
  entry_due_on?: string;
  entry_percent?: string;
  entry_amount?: string;
  percentages?: string[];
  amounts?: string[];
  dates?: string[];
}
export interface BudgetInput {
  organization_id?: number;
  company_id: number;
  project_id: number | null;
  number: string;
  prepared_on: string;
  valid_until: string;
  segment: string | null;
  services: string[];
  estimated_assets: number;
  unit_ids: number[];
  addresses: string[];
  scope: string;
  notes: string | null;
  operational_constraints: string | null;
  responsible_id: number;
  pricing_id: number;
  sizing: Sizing;
  payment: PaymentInput;
}
export interface Payment {
  mode: string;
  entry: string;
  financed_balance: string;
  total: string;
  remaining_balance: string;
  rows: {
    position: number;
    kind: string;
    due_on: string;
    amount: string;
    percentage: string;
  }[];
}
export interface Calculation {
  engine_version: string;
  currency: string;
  inputs: {
    assets: number;
    address_count: number;
    productivity: number;
    address_factor: string;
    available_days: number;
  };
  sizing: {
    person_days: number;
    required_team: number;
    team: number;
    field_days: number;
    extra_days: number;
    stay_days: number;
    rooms: number;
    effort_assets: number;
    effort_addresses: number;
  };
  formulas: Record<string, string>;
  lines: {
    key: string;
    label: string;
    quantity: number;
    unit_value: string;
    subtotal: string;
    formula: string;
  }[];
  cost_total: string;
  rates: { tax_pct: string; commission_pct: string; margin_pct: string };
  gross_up_price: string;
  minimum_price: string;
  suggested_price: string;
  final_price: string;
  tax_amount: string;
  commission_amount: string;
  margin_amount: string;
  manual_adjustments: (Sizing & { reason: string }) | null;
  payment: Payment;
}
export interface Snapshot {
  input: BudgetInput;
  pricing: {
    id: number;
    name: string;
    version: number;
    valid_from: string;
    valid_to: string;
    values: PricingValues;
  };
  context: {
    company: { id: number; name: string; address: string | null };
    project: { id: number; name: string } | null;
    units: { id: number; name: string; address: string }[];
    responsible: { id: number; login: string };
  };
  calculation: Calculation;
}
export interface Version {
  id: number;
  version: number;
  kind: string;
  name: string;
  baseVersionId: number | null;
  snapshot: Snapshot;
  hash: string;
  reason: string;
  actorId: number;
  recordedAt: string;
}
export interface Budget {
  id: number;
  organizationId: number;
  companyId: number;
  projectId: number | null;
  number: string;
  status: string;
  revision: number;
  headVersionId: number;
  approvedVersionId: number | null;
  createdAt: string;
  current?: Version;
}
export interface BudgetDetail extends Budget {
  versions: Version[];
  audit: {
    id: number;
    revision: number;
    operation: string;
    details: { from?: string; to?: string; version_id?: number };
    reason: string;
    actorId: number;
    recordedAt: string;
  }[];
}
export interface Proposal {
  budget_id: number;
  number: string;
  version: number;
  hash: string;
  company: Snapshot["context"]["company"];
  project: Snapshot["context"]["project"];
  scope: string;
  services: string[];
  assets: number;
  units: Snapshot["context"]["units"];
  addresses: string[];
  field_days: number;
  team: number;
  valid_until: string;
  currency: string;
  final_price: string;
  payment: Payment;
}
export interface ContractIntent extends Proposal {
  eligible_for_future_conversion: boolean;
  required_before_conversion: string[];
  creates_contract: false;
}
export const budgetApi = {
  list: (filters: Record<string, string | number>) =>
    api
      .get<{
        items: Budget[];
        total: number;
        page: number;
        page_size: number;
      }>("/budgets", { params: filters })
      .then((r) => r.data),
  pricing: () => api.get<Pricing[]>("/budgets/pricing").then((r) => r.data),
  publish: (
    data: PricingValues & {
      name: string;
      valid_from: string;
      valid_to: string;
      reason: string;
    },
  ) => api.post<Pricing>("/budgets/pricing", data).then((r) => r.data),
  create: (data: BudgetInput) =>
    api.post<Budget>("/budgets", data).then((r) => r.data),
  simulate: (data: BudgetInput) =>
    api.post<Snapshot>("/budgets/simulate", data).then((r) => r.data),
  detail: (id: number) =>
    api.get<BudgetDetail>(`/budgets/${id}`).then((r) => r.data),
  version: (
    id: number,
    data: BudgetInput & {
      revision: number;
      name: string;
      reason: string;
      base_version_id: number;
    },
    scenario: boolean,
  ) =>
    (scenario
      ? api.post<Budget>(`/budgets/${id}/scenarios`, data)
      : api.put<Budget>(`/budgets/${id}/versions`, data)
    ).then((r) => r.data),
  transition: (
    id: number,
    data: {
      revision: number;
      status: string;
      version_id: number;
      reason: string;
    },
  ) => api.post<Budget>(`/budgets/${id}/transitions`, data).then((r) => r.data),
  proposal: (id: number) =>
    api.get<Proposal>(`/budgets/${id}/proposal`).then((r) => r.data),
  contractPreview: (id: number) =>
    api
      .get<ContractIntent>(`/budgets/${id}/contract-preview`)
      .then((r) => r.data),
};
export const budgetMoney = (v: string, currency: string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(
    Number(v),
  );
export const budgetDate = (v: string) =>
  v.slice(0, 10).split("-").reverse().join("/");
