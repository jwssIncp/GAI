import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pendingIssuesApi } from '@/api/endpoints';
import type {
  CreateInventoryPendingIssueRequest,
  InventoryPendingIssueInput,
  InventoryPendingIssueSeverity,
  InventoryPendingIssueStatus,
  InventoryPendingIssueType,
  PageParams,
  ResolveInventoryPendingIssueRequest,
} from '@/types/api';

export type PendingIssueListParams = PageParams & {
  type?: InventoryPendingIssueType | '';
  status?: InventoryPendingIssueStatus | '';
  severity?: InventoryPendingIssueSeverity | '';
  inventory_item_id?: number;
  accounting_item_id?: number;
  plate?: string;
};

export const pendingIssueKeys = {
  all: ['pending-issues'] as const,
  project: (projectId: number) => [...pendingIssueKeys.all, 'project', projectId] as const,
  list: (projectId: number, params: PendingIssueListParams) => [...pendingIssueKeys.project(projectId), 'list', params] as const,
  detail: (projectId: number, id?: number) => [...pendingIssueKeys.project(projectId), 'detail', id] as const,
};

export function useProjectPendingIssues(projectId: number, params: PendingIssueListParams) {
  return useQuery({
    queryKey: pendingIssueKeys.list(projectId, params),
    queryFn: () => pendingIssuesApi.list(projectId, params),
    enabled: Number.isFinite(projectId),
  });
}

export function useProjectPendingIssue(projectId: number, id?: number) {
  return useQuery({
    queryKey: pendingIssueKeys.detail(projectId, id),
    queryFn: () => pendingIssuesApi.get(projectId, id!),
    enabled: Number.isFinite(projectId) && Boolean(id),
  });
}

export function useCreatePendingIssue(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateInventoryPendingIssueRequest) => pendingIssuesApi.create(projectId, payload),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: pendingIssueKeys.project(projectId) }),
  });
}

export function useUpdatePendingIssue(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: InventoryPendingIssueInput }) => pendingIssuesApi.update(projectId, id, payload),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: pendingIssueKeys.project(projectId) });
      await queryClient.invalidateQueries({ queryKey: pendingIssueKeys.detail(projectId, variables.id) });
    },
  });
}

export function useResolvePendingIssue(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ResolveInventoryPendingIssueRequest }) => pendingIssuesApi.resolve(projectId, id, payload),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: pendingIssueKeys.project(projectId) });
      await queryClient.invalidateQueries({ queryKey: pendingIssueKeys.detail(projectId, variables.id) });
    },
  });
}

export function useIgnorePendingIssue(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ResolveInventoryPendingIssueRequest }) => pendingIssuesApi.ignore(projectId, id, payload),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: pendingIssueKeys.project(projectId) });
      await queryClient.invalidateQueries({ queryKey: pendingIssueKeys.detail(projectId, variables.id) });
    },
  });
}

export function useCancelPendingIssue(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => pendingIssuesApi.cancel(projectId, id),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: pendingIssueKeys.project(projectId) }),
  });
}

export function useGeneratePendingIssues(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => pendingIssuesApi.generate(projectId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: pendingIssueKeys.project(projectId) });
      await queryClient.invalidateQueries({ queryKey: ['project-summary', projectId] });
    },
  });
}
