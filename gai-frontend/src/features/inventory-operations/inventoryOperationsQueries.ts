import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inventoryOperationsApi } from '@/api/endpoints';
import type { ConsolidationDecision, CreateInventoryObservationRequest, InventorySessionStatus, PageParams, ReconciliationStatus } from '@/types/api';

export const inventoryOperationKeys = {
  project: (projectId: number) => ['inventory-operations', projectId] as const,
  sessions: (projectId: number, params: object) => [...inventoryOperationKeys.project(projectId), 'sessions', params] as const,
  session: (projectId: number, sessionId: number) => [...inventoryOperationKeys.project(projectId), 'session', sessionId] as const,
  observations: (projectId: number, sessionId: number, params: object) => [...inventoryOperationKeys.session(projectId, sessionId), 'observations', params] as const,
  reconciliations: (projectId: number, sessionId: number, params: object) => [...inventoryOperationKeys.session(projectId, sessionId), 'reconciliations', params] as const,
};

export function useInventorySessions(projectId: number, params: PageParams & { status?: InventorySessionStatus }) {
  return useQuery({ queryKey: inventoryOperationKeys.sessions(projectId, params), queryFn: () => inventoryOperationsApi.listSessions(projectId, params), enabled: Number.isFinite(projectId) });
}

export function useInventorySession(projectId: number, sessionId: number) {
  return useQuery({ queryKey: inventoryOperationKeys.session(projectId, sessionId), queryFn: () => inventoryOperationsApi.getSession(projectId, sessionId), enabled: Number.isFinite(projectId) && Number.isFinite(sessionId) });
}

function useInventoryMutation<TVariables>(projectId: number, mutationFn: (variables: TVariables) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({ mutationFn, onSuccess: async () => client.invalidateQueries({ queryKey: inventoryOperationKeys.project(projectId) }) });
}

export function useCreateInventorySession(projectId: number) { return useInventoryMutation(projectId, (payload: { name: string }) => inventoryOperationsApi.createSession(projectId, payload)); }
export function useStartInventorySession(projectId: number, sessionId: number) { return useInventoryMutation(projectId, () => inventoryOperationsApi.startSession(projectId, sessionId)); }
export function useRequestReinventory(projectId: number, sessionId: number) { return useInventoryMutation(projectId, (payload: { inventory_item_id: number; reason: string }) => inventoryOperationsApi.requestReinventory(projectId, sessionId, payload)); }
export function useCreateObservation(projectId: number, sessionId: number) { return useInventoryMutation(projectId, (value: { roundId: number; payload: CreateInventoryObservationRequest }) => inventoryOperationsApi.createObservation(projectId, sessionId, value.roundId, value.payload)); }
export function useFinishRound(projectId: number, sessionId: number) { return useInventoryMutation(projectId, (roundId: number) => inventoryOperationsApi.finishRound(projectId, sessionId, roundId)); }

export function useInventoryObservations(projectId: number, sessionId: number, params: PageParams & { round_id?: number; inventory_item_id?: number; field_agent_id?: number }) {
  return useQuery({ queryKey: inventoryOperationKeys.observations(projectId, sessionId, params), queryFn: () => inventoryOperationsApi.listObservations(projectId, sessionId, params), enabled: Number.isFinite(sessionId) });
}

export function useReconciliations(projectId: number, sessionId: number, params: PageParams & { run_number?: number; status?: ReconciliationStatus | '' }) {
  return useQuery({ queryKey: inventoryOperationKeys.reconciliations(projectId, sessionId, params), queryFn: () => inventoryOperationsApi.listReconciliations(projectId, sessionId, params), enabled: Number.isFinite(sessionId) });
}
export function useRunReconciliation(projectId: number, sessionId: number) { return useInventoryMutation(projectId, () => inventoryOperationsApi.reconcile(projectId, sessionId)); }
export function useConsolidate(projectId: number, sessionId: number) { return useInventoryMutation(projectId, (value: { id: number; decision: ConsolidationDecision; notes?: string }) => inventoryOperationsApi.consolidate(projectId, sessionId, value.id, { decision: value.decision, notes: value.notes })); }
