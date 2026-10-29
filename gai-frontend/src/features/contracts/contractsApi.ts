import { api } from "@/api/http";
export const commercialFilterKeys = [
  "contract_from",
  "contract_to",
  "contract_status",
  "segment",
  "contract_state",
  "recurring",
  "service",
  "assets_min",
  "assets_max",
];
export const contractStatuses: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativo",
  suspended: "Suspenso",
  completed: "Concluído",
  cancelled: "Cancelado",
  archived: "Arquivado",
};
export interface ContractData {
  number: string;
  company_id: number;
  contracted_on: string | null;
  starts_on: string | null;
  ends_on: string | null;
  original_value: string | null;
  currency: string;
  contracting_type: string | null;
  segment: string | null;
  commercial_origin: string | null;
  recurring: boolean | null;
  services: string[];
  estimated_assets: number | null;
  scope: string | null;
  commercial_terms: string | null;
  status: string;
}
export interface ContractSnapshot extends ContractData {
  current_value: string | null;
  current_ends_on: string | null;
  current_scope: string | null;
  company_name: string;
  company_state: string | null;
}
export interface Contract {
  id: number;
  projectId: number;
  revision: number;
  data: ContractSnapshot;
}
export interface ContractVersion {
  id: number;
  revision: number;
  operation: string;
  reason: string;
  actorId: number;
  recordedAt: string;
  data: ContractSnapshot;
}
export interface Amendment {
  id: number;
  identifier: string;
  datedOn: string;
  type: string;
  valueDelta: string | null;
  endsOn: string | null;
  scope: string | null;
  reason: string;
  actorId: number;
  revision: number;
}
export interface ContractDetail extends Contract {
  versions: ContractVersion[];
  amendments: Amendment[];
}
export const contractsApi = {
  list: (p: number) =>
    api.get<Contract[]>(`/projects/${p}/contracts`).then((r) => r.data),
  get: (p: number, id: number) =>
    api
      .get<ContractDetail>(`/projects/${p}/contracts/${id}`)
      .then((r) => r.data),
  create: (p: number, data: ContractData) =>
    api.post<Contract>(`/projects/${p}/contracts`, data).then((r) => r.data),
  edit: (
    p: number,
    id: number,
    data: ContractData & { revision: number; reason: string },
  ) =>
    api
      .patch<Contract>(`/projects/${p}/contracts/${id}`, data)
      .then((r) => r.data),
  amend: (p: number, id: number, data: object) =>
    api.post(`/projects/${p}/contracts/${id}/amendments`, data),
  archive: (
    p: number,
    id: number,
    data: { revision: number; reason: string },
  ) => api.post(`/projects/${p}/contracts/${id}/archive`, data),
};
export const contractMoney = (value: string | null, currency: string) =>
  value == null
    ? "Não informado"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(
        Number(value),
      );
export const contractDate = (value?: string | null) =>
  value ? value.slice(0, 10).split("-").reverse().join("/") : "Não informada";
