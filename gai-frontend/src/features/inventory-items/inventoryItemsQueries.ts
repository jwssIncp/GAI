import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inventoryItemImagesApi, inventoryItemsApi } from '@/api/endpoints';
import { projectKeys } from '@/features/projects/projectQueries';
import type { InventoryItemInput, PageParams } from '@/types/api';

export const inventoryItemKeys = {
  all: ['inventory-items'] as const,
  project: (projectId: number) => [...inventoryItemKeys.all, 'project', projectId] as const,
  list: (projectId: number, params: PageParams) => [...inventoryItemKeys.project(projectId), 'list', params] as const,
  detail: (projectId: number, id?: number) => [...inventoryItemKeys.project(projectId), 'detail', id] as const,
  images: (projectId: number, itemId?: number) => [...inventoryItemKeys.project(projectId), 'images', itemId] as const,
};

export function useProjectInventoryItems(projectId: number, params: PageParams & { old_plate?: string; new_plate?: string; description?: string }) {
  return useQuery({ queryKey: inventoryItemKeys.list(projectId, params), queryFn: () => inventoryItemsApi.listByProject(projectId, params), enabled: Number.isFinite(projectId) });
}

export function useProjectInventoryItem(projectId: number, id?: number) {
  return useQuery({ queryKey: inventoryItemKeys.detail(projectId, id), queryFn: () => inventoryItemsApi.getByProject(projectId, id!), enabled: Number.isFinite(projectId) && Boolean(id) });
}

export function useInventoryItemImages(projectId: number, itemId?: number) {
  return useQuery({ queryKey: inventoryItemKeys.images(projectId, itemId), queryFn: () => inventoryItemImagesApi.list(projectId, itemId!, { page: 1, page_size: 6 }), enabled: Number.isFinite(projectId) && Boolean(itemId) });
}

export function useCreateInventoryItem(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: InventoryItemInput) => inventoryItemsApi.create(projectId, payload),
    onSuccess: async () => Promise.all([
      queryClient.invalidateQueries({ queryKey: inventoryItemKeys.project(projectId) }),
      queryClient.invalidateQueries({ queryKey: projectKeys.dashboard(projectId) }),
    ]),
  });
}

export function useUpdateInventoryItem(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: InventoryItemInput }) => inventoryItemsApi.update(projectId, id, payload),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: inventoryItemKeys.project(projectId) });
      await queryClient.invalidateQueries({ queryKey: inventoryItemKeys.detail(projectId, variables.id) });
      await queryClient.invalidateQueries({ queryKey: projectKeys.dashboard(projectId) });
    },
  });
}

export function useChangeInventoryItemStatus(projectId: number, action: 'deactivate' | 'reactivate') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => (action === 'deactivate' ? inventoryItemsApi.deactivate(projectId, id) : inventoryItemsApi.reactivate(projectId, id)),
    onSuccess: async () => Promise.all([
      queryClient.invalidateQueries({ queryKey: inventoryItemKeys.project(projectId) }),
      queryClient.invalidateQueries({ queryKey: projectKeys.dashboard(projectId) }),
    ]),
  });
}
