import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountingImportsApi, accountingItemsApi } from '@/api/endpoints';
import { projectKeys } from '@/features/projects/projectQueries';
import type { InventoryAccountingItemInput, InventoryAccountingItemStatus, PageParams } from '@/types/api';

export type AccountingItemListParams = PageParams & {
  plate?: string;
  base_code?: string;
  investor_code?: string;
  description?: string;
  status?: InventoryAccountingItemStatus | '';
};

export const accountingItemKeys = {
  all: ['accounting-items'] as const,
  project: (projectId: number) => [...accountingItemKeys.all, 'project', projectId] as const,
  list: (projectId: number, params: AccountingItemListParams) => [...accountingItemKeys.project(projectId), 'list', params] as const,
  detail: (projectId: number, id?: number) => [...accountingItemKeys.project(projectId), 'detail', id] as const,
};

export const accountingImportKeys = {
  all: ['accounting-imports'] as const,
  project: (projectId: number) => [...accountingImportKeys.all, 'project', projectId] as const,
  list: (projectId: number, params: PageParams) => [...accountingImportKeys.project(projectId), 'list', params] as const,
  errors: (projectId: number, batchId?: number) => [...accountingImportKeys.project(projectId), 'errors', batchId] as const,
};

export function useProjectAccountingItems(projectId: number, params: AccountingItemListParams) {
  return useQuery({
    queryKey: accountingItemKeys.list(projectId, params),
    queryFn: () => accountingItemsApi.list(projectId, params),
    enabled: Number.isFinite(projectId),
  });
}

export function useProjectAccountingItem(projectId: number, id?: number) {
  return useQuery({
    queryKey: accountingItemKeys.detail(projectId, id),
    queryFn: () => accountingItemsApi.get(projectId, id!),
    enabled: Number.isFinite(projectId) && Boolean(id),
  });
}

export function useUpdateAccountingItem(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: InventoryAccountingItemInput }) => accountingItemsApi.update(projectId, id, payload),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: accountingItemKeys.project(projectId) });
      await queryClient.invalidateQueries({ queryKey: accountingItemKeys.detail(projectId, variables.id) });
      await queryClient.invalidateQueries({ queryKey: projectKeys.dashboard(projectId) });
    },
  });
}

export function useChangeAccountingItemStatus(projectId: number, action: 'deactivate' | 'reactivate') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => (action === 'deactivate' ? accountingItemsApi.deactivate(projectId, id) : accountingItemsApi.reactivate(projectId, id)),
    onSuccess: async () => Promise.all([
      queryClient.invalidateQueries({ queryKey: accountingItemKeys.project(projectId) }),
      queryClient.invalidateQueries({ queryKey: projectKeys.dashboard(projectId) }),
    ]),
  });
}

export function useAccountingImports(projectId: number, params: PageParams = { page: 1, page_size: 5 }) {
  return useQuery({
    queryKey: accountingImportKeys.list(projectId, params),
    queryFn: () => accountingImportsApi.list(projectId, params),
    enabled: Number.isFinite(projectId),
  });
}

export function useImportAccountingFile(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => accountingImportsApi.importFile(projectId, file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accountingItemKeys.project(projectId) });
      await queryClient.invalidateQueries({ queryKey: accountingImportKeys.project(projectId) });
      await queryClient.invalidateQueries({ queryKey: projectKeys.dashboard(projectId) });
    },
  });
}

export function useAccountingImportErrors(projectId: number, batchId?: number) {
  return useQuery({
    queryKey: accountingImportKeys.errors(projectId, batchId),
    queryFn: () => accountingImportsApi.errors(projectId, batchId!),
    enabled: Number.isFinite(projectId) && Boolean(batchId),
  });
}
