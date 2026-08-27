import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { inventoryOperationsApi } from '@/api/endpoints';
import { uploadToPresignedUrl } from '@/api/http';
import { projectKeys } from '@/features/projects/projectQueries';
import type {
  ConsolidationDecision,
  CreateInventoryEvidenceUploadRequest,
  CreateInventoryObservationRequest,
  InventoryRoundKind,
  InventoryRoundStatus,
  InventorySessionStatus,
  PageParams,
  ReconciliationStatus,
} from '@/types/api';

export const inventoryOperationKeys = {
  project: (projectId: number) => ['inventory-operations', projectId] as const,
  sessions: (projectId: number, params: object) => [...inventoryOperationKeys.project(projectId), 'sessions', params] as const,
  session: (projectId: number, sessionId: number) => [...inventoryOperationKeys.project(projectId), 'session', sessionId] as const,
  roundsRoot: (projectId: number, sessionId: number) => [...inventoryOperationKeys.session(projectId, sessionId), 'rounds'] as const,
  rounds: (projectId: number, sessionId: number, params: object) => [...inventoryOperationKeys.roundsRoot(projectId, sessionId), params] as const,
  observations: (projectId: number, sessionId: number, params: object) => [...inventoryOperationKeys.session(projectId, sessionId), 'observations', params] as const,
  evidenceRoot: (projectId: number, sessionId: number, roundId: number, observationId: number) => [...inventoryOperationKeys.session(projectId, sessionId), 'round', roundId, 'observation', observationId, 'evidence'] as const,
  evidence: (projectId: number, sessionId: number, roundId: number, observationId: number, params: object) => [...inventoryOperationKeys.evidenceRoot(projectId, sessionId, roundId, observationId), params] as const,
  reconciliations: (projectId: number, sessionId: number, params: object) => [...inventoryOperationKeys.session(projectId, sessionId), 'reconciliations', params] as const,
};

function invalidateInventoryProject(client: QueryClient, projectId: number) {
  return Promise.all([
    client.invalidateQueries({ queryKey: inventoryOperationKeys.project(projectId) }),
    client.invalidateQueries({ queryKey: projectKeys.dashboard(projectId) }),
  ]);
}

export function useInventorySessions(projectId: number, params: PageParams & { status?: InventorySessionStatus }) {
  return useQuery({ queryKey: inventoryOperationKeys.sessions(projectId, params), queryFn: () => inventoryOperationsApi.listSessions(projectId, params), enabled: Number.isFinite(projectId) });
}

export function useInventorySession(projectId: number, sessionId: number) {
  return useQuery({ queryKey: inventoryOperationKeys.session(projectId, sessionId), queryFn: () => inventoryOperationsApi.getSession(projectId, sessionId), enabled: Number.isFinite(projectId) && Number.isFinite(sessionId) });
}

export function useInventoryRounds(projectId: number, sessionId: number, params: PageParams & { status?: InventoryRoundStatus | ''; type?: InventoryRoundKind | '' }) {
  return useQuery({ queryKey: inventoryOperationKeys.rounds(projectId, sessionId, params), queryFn: () => inventoryOperationsApi.listRounds(projectId, sessionId, params), enabled: Number.isFinite(projectId) && Number.isFinite(sessionId) });
}

function useInventoryMutation<TData, TVariables>(projectId: number, mutationFn: (variables: TVariables) => Promise<TData>) {
  const client = useQueryClient();
  return useMutation({ mutationFn, onSuccess: async () => invalidateInventoryProject(client, projectId) });
}

export function useCreateInventorySession(projectId: number) { return useInventoryMutation(projectId, (payload: { name: string }) => inventoryOperationsApi.createSession(projectId, payload)); }
export function useStartInventorySession(projectId: number, sessionId: number) { return useInventoryMutation(projectId, () => inventoryOperationsApi.startSession(projectId, sessionId)); }
export function useFinishInventorySession(projectId: number, sessionId: number) { return useInventoryMutation(projectId, () => inventoryOperationsApi.finishSession(projectId, sessionId)); }
export function useCancelInventorySession(projectId: number, sessionId: number) { return useInventoryMutation(projectId, (payload: { reason: string }) => inventoryOperationsApi.cancelSession(projectId, sessionId, payload)); }
export function useRequestReinventory(projectId: number, sessionId: number) { return useInventoryMutation(projectId, (payload: { inventory_item_id: number; reason: string }) => inventoryOperationsApi.requestReinventory(projectId, sessionId, payload)); }

export function useCreateObservation(projectId: number, sessionId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (value: { roundId: number; payload: CreateInventoryObservationRequest }) => inventoryOperationsApi.createObservation(projectId, sessionId, value.roundId, value.payload),
    onSuccess: async () => Promise.all([
      invalidateInventoryProject(client, projectId),
      client.invalidateQueries({ queryKey: ['plate-history', projectId] }),
    ]),
  });
}

export function useFinishRound(projectId: number, sessionId: number) { return useInventoryMutation(projectId, (roundId: number) => inventoryOperationsApi.finishRound(projectId, sessionId, roundId)); }

export function useInventoryObservations(projectId: number, sessionId: number, params: PageParams & { round_id?: number; inventory_item_id?: number; field_agent_id?: number }) {
  return useQuery({ queryKey: inventoryOperationKeys.observations(projectId, sessionId, params), queryFn: () => inventoryOperationsApi.listObservations(projectId, sessionId, params), enabled: Number.isFinite(sessionId) });
}

export function useInventoryEvidence(projectId: number, sessionId: number, roundId: number, observationId: number, params: PageParams, enabled = true) {
  return useQuery({
    queryKey: inventoryOperationKeys.evidence(projectId, sessionId, roundId, observationId, params),
    queryFn: () => inventoryOperationsApi.listEvidence(projectId, sessionId, roundId, observationId, params),
    enabled: enabled && Number.isFinite(projectId) && Number.isFinite(sessionId) && Number.isFinite(roundId) && Number.isFinite(observationId),
  });
}

export function useUploadInventoryEvidence(projectId: number, sessionId: number, roundId: number, observationId: number, onProgress?: (progress: number) => void) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const payload: CreateInventoryEvidenceUploadRequest = {
        original_name: file.name,
        mime_type: file.type as CreateInventoryEvidenceUploadRequest['mime_type'],
        size_bytes: file.size,
      };
      const response = await inventoryOperationsApi.createEvidenceUploadUrl(projectId, sessionId, roundId, observationId, payload);
      await uploadToPresignedUrl(response.upload_url, file, onProgress);
      return inventoryOperationsApi.confirmEvidenceUpload(projectId, sessionId, roundId, observationId, response.evidence.id, { size_bytes: file.size });
    },
    onSuccess: async () => client.invalidateQueries({ queryKey: inventoryOperationKeys.evidenceRoot(projectId, sessionId, roundId, observationId) }),
  });
}

export function useInventoryEvidenceDownloadUrl(projectId: number, sessionId: number, roundId: number, observationId: number) {
  return useMutation({ mutationFn: (evidenceId: number) => inventoryOperationsApi.evidenceDownloadUrl(projectId, sessionId, roundId, observationId, evidenceId) });
}

export function useReconciliations(projectId: number, sessionId: number, params: PageParams & { run_number?: number; status?: ReconciliationStatus | '' }) {
  return useQuery({ queryKey: inventoryOperationKeys.reconciliations(projectId, sessionId, params), queryFn: () => inventoryOperationsApi.listReconciliations(projectId, sessionId, params), enabled: Number.isFinite(sessionId) });
}
export function useRunReconciliation(projectId: number, sessionId: number) { return useInventoryMutation(projectId, () => inventoryOperationsApi.reconcile(projectId, sessionId)); }
export function useConsolidate(projectId: number, sessionId: number) { return useInventoryMutation(projectId, (value: { id: number; decision: ConsolidationDecision; notes?: string }) => inventoryOperationsApi.consolidate(projectId, sessionId, value.id, { decision: value.decision, notes: value.notes })); }
