import { api } from "@/api/http";
export interface MatchingConfig {
  version: 1;
  textThreshold: number;
  localTextThreshold: number;
  descriptionAlertThreshold: number;
}
export interface MatchSource {
  id: number;
  plate: string | null;
  serial: string | null;
  description: string | null;
  location: string | null;
  unit: string | null;
  version: string;
  observationId?: number;
  roundId?: number;
}
export interface AssistedRun {
  id: number;
  config: MatchingConfig;
  sourceHash: string;
  afterItemId: number;
  nextItemId: number | null;
  summary: Record<string, number>;
  createdAt: string;
}
export interface AssistedCandidate {
  id: number;
  physical: MatchSource;
  accounting: MatchSource | null;
  status: string;
  revision: number;
  warnings: string[];
  evidence: {
    rule: string;
    coincident: string[];
    divergent: string[];
    missing: string[];
    similarity: number | null;
    score: number;
    alerts: string[];
  } | null;
}
export interface AssistedPage {
  run: AssistedRun;
  stale: boolean;
  items: AssistedCandidate[];
  total: number;
  page: number;
  page_size: number;
}
export interface AssistedDecision {
  id: number;
  action: string;
  reason: string;
  actorId: number;
  revision: number;
  createdAt: string;
  reconciliationId: number | null;
  sourceHash: string;
}
export interface AssistedDecisionInput {
  revision: number;
  source_hash: string;
  action: "approved" | "rejected";
  reason: string;
  command_key: string;
}
const base = (p: number, s: number) =>
  `/projects/${p}/inventory-sessions/${s}/assisted-reconciliation`;
export const assistedApi = {
  runs: async (p: number, s: number, page: number) =>
    (
      await api.get<{ items: AssistedRun[]; total: number }>(
        base(p, s) + "/runs",
        { params: { page, page_size: 20 } },
      )
    ).data,
  generate: async (
    p: number,
    s: number,
    after_item_id: number,
    config: MatchingConfig,
  ) =>
    (
      await api.post<AssistedRun>(base(p, s) + "/runs", {
        after_item_id,
        config,
      })
    ).data,
  candidates: async (
    p: number,
    s: number,
    r: number,
    page: number,
    status: string,
  ) =>
    (
      await api.get<AssistedPage>(base(p, s) + `/runs/${r}/candidates`, {
        params: { page, page_size: 20, status: status || undefined },
      })
    ).data,
  decide: async (
    p: number,
    s: number,
    id: number,
    dto: AssistedDecisionInput,
  ) =>
    (await api.post(base(p, s) + `/candidates/${id}/decisions`, dto)).data as {
      id: number;
      status: string;
      revision: number;
      reconciliationId: number | null;
    },
  history: async (p: number, s: number, id: number, page: number) =>
    (
      await api.get<{ items: AssistedDecision[]; total: number }>(
        base(p, s) + `/candidates/${id}/history`,
        { params: { page, page_size: 20 } },
      )
    ).data,
};
