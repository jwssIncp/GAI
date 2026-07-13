import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { uploadToPresignedUrl } from '@/api/http';
import { inventoryItemImagesApi } from '@/api/endpoints';
import { projectKeys } from '@/features/projects/projectQueries';
import type { CreateInventoryItemImageUploadRequest, PageParams } from '@/types/api';

export const inventoryItemImageKeys = {
  all: ['inventory-item-images'] as const,
  projectItem: (projectId: number, itemId?: number) => [...inventoryItemImageKeys.all, 'project', projectId, 'item', itemId] as const,
  list: (projectId: number, itemId: number | undefined, params: PageParams) => [...inventoryItemImageKeys.projectItem(projectId, itemId), 'list', params] as const,
};

export function useInventoryItemImages(projectId: number, itemId?: number, params: PageParams = { page: 1, page_size: 12 }) {
  return useQuery({
    queryKey: inventoryItemImageKeys.list(projectId, itemId, params),
    queryFn: () => inventoryItemImagesApi.list(projectId, itemId!, params),
    enabled: Number.isFinite(projectId) && Boolean(itemId),
  });
}

export function useUploadInventoryItemImage(projectId: number, itemId: number, onProgress?: (progress: number) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const payload: CreateInventoryItemImageUploadRequest = {
        original_name: file.name,
        mime_type: file.type as CreateInventoryItemImageUploadRequest['mime_type'],
        size_bytes: file.size,
      };
      const response = await inventoryItemImagesApi.createUploadUrl(projectId, itemId, payload);
      await uploadToPresignedUrl(response.upload_url, file, onProgress);
      return inventoryItemImagesApi.confirmUpload(projectId, itemId, response.image.id, { size_bytes: file.size });
    },
    onSuccess: async () => Promise.all([
      queryClient.invalidateQueries({ queryKey: inventoryItemImageKeys.projectItem(projectId, itemId) }),
      queryClient.invalidateQueries({ queryKey: projectKeys.dashboard(projectId) }),
    ]),
  });
}

export function useInventoryItemImageDownloadUrl(projectId: number, itemId: number) {
  return useMutation({
    mutationFn: (imageId: number) => inventoryItemImagesApi.downloadUrl(projectId, itemId, imageId),
  });
}

export function useRemoveInventoryItemImage(projectId: number, itemId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (imageId: number) => inventoryItemImagesApi.remove(projectId, itemId, imageId),
    onSuccess: async () => Promise.all([
      queryClient.invalidateQueries({ queryKey: inventoryItemImageKeys.projectItem(projectId, itemId) }),
      queryClient.invalidateQueries({ queryKey: projectKeys.dashboard(projectId) }),
    ]),
  });
}
