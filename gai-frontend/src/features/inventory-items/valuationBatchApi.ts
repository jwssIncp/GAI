import { api } from "@/api/http";
import type { AssetValuation, InventoryItemStatus } from "@/types/api";
export interface ValuationFilters {
  search?: string;
  status?: InventoryItemStatus;
  old_plate?: string;
  new_plate?: string;
  description?: string;
}
export interface ValuationSelection {
  kind: "ids" | "filters";
  ids?: number[];
  filters?: ValuationFilters;
  exclude_ids?: number[];
}
export interface ValuationSnapshot {
  id: number;
  old_plate: string | null;
  new_plate: string | null;
  description: string | null;
  status: string;
  last_valuation: Partial<AssetValuation> | null;
  version: string;
}
export interface ValuationInput {
  source: string;
  valuation_date: string;
  new_value: string | null;
  used_value: string | null;
  notes: string | null;
}
export interface BatchInput {
  selection: ValuationSelection;
  mode: "common" | "individual";
  common: ValuationInput;
  values?: {
    inventory_item_id: number;
    new_value: string | null;
    used_value: string | null;
  }[];
  command_key: string;
}
export interface BatchSummary {
  total_requested: number;
  total_processed: number;
  total_approved: number;
  total_rejected: number;
  errors: { inventory_item_id: number; reason: string }[];
}
export interface BatchHeader {
  id: number;
  projectId: number;
  status: string;
  total: number;
  revision: number;
  previewHash: string;
  commandKey: string;
  createdAt: string;
  createdById: number;
  confirmedAt: string | null;
  confirmedById: number | null;
}
export interface ValuationBatchResult extends BatchHeader {
  project: { id: number; name: string };
  request: BatchInput;
  summary: BatchSummary;
  expired: boolean;
  items: {
    inventoryItemId: number;
    snapshot: ValuationSnapshot;
    proposed: {
      source: string;
      valuationDate: string;
      newValue: string | null;
      usedValue: string | null;
      notes: string | null;
    };
    valuationId: number | null;
    status: string;
    error: string | null;
  }[];
}
const base = (p: number) => `/projects/${p}/valuation-batches`;
export const valuationBatchApi = {
  selection: async (p: number, selection: ValuationSelection) =>
    (
      await api.post<{
        project: { id: number; name: string };
        limit: number;
        total: number;
        items: ValuationSnapshot[];
      }>(base(p) + "/selection", { selection })
    ).data,
  preview: async (p: number, dto: BatchInput) =>
    (await api.post<ValuationBatchResult>(base(p) + "/preview", dto)).data,
  confirm: async (p: number, batch: BatchHeader) =>
    (
      await api.post<ValuationBatchResult>(base(p) + `/${batch.id}/confirm`, {
        revision: 1,
        preview_hash: batch.previewHash,
        command_key: batch.commandKey,
      })
    ).data,
  list: async (p: number, page: number) =>
    (
      await api.get<{ items: BatchHeader[]; total: number; limit: number }>(
        base(p),
        { params: { page, page_size: 10 } },
      )
    ).data,
  get: async (p: number, id: number) =>
    (await api.get<ValuationBatchResult>(base(p) + `/${id}`)).data,
};
