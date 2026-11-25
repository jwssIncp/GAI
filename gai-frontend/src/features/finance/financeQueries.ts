import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { expenseAttachmentsApi } from '@/api/endpoints';
import { uploadToPresignedUrl } from '@/api/http';
import { projectKeys } from '@/features/projects/projectQueries';

export const financeKeys = {
  all: ['finance'] as const,
  project: (projectId: number) => [...financeKeys.all, 'project', projectId] as const,
  attachments: (projectId: number, expenseId?: number) => [...financeKeys.project(projectId), 'expense-attachments', expenseId] as const,
};

function invalidateFinance(queryClient: ReturnType<typeof useQueryClient>, projectId: number) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: financeKeys.project(projectId) }),
    queryClient.invalidateQueries({ queryKey: projectKeys.dashboard(projectId) }),
  ]);
}

export function useExpenseAttachments(projectId: number, expenseId?: number) {
  return useQuery({
    queryKey: financeKeys.attachments(projectId, expenseId),
    queryFn: () => expenseAttachmentsApi.list(projectId, expenseId!),
    enabled: Number.isFinite(projectId) && Boolean(expenseId),
  });
}

/** Envia um comprovante: pede a URL assinada, sobe o arquivo e confirma no servidor. */
export async function uploadExpenseAttachment(
  projectId: number,
  expenseId: number,
  file: File,
  onProgress?: (progress: number) => void,
) {
  const response = await expenseAttachmentsApi.createUploadUrl(projectId, expenseId, {
    original_name: file.name,
    mime_type: file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf',
    size_bytes: file.size,
  });
  await uploadToPresignedUrl(response.upload_url, file, onProgress);
  return expenseAttachmentsApi.confirmUpload(projectId, expenseId, response.attachment.id, { size_bytes: file.size });
}

export function useUploadExpenseAttachment(projectId: number, expenseId: number, onProgress?: (progress: number) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadExpenseAttachment(projectId, expenseId, file, onProgress),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: financeKeys.attachments(projectId, expenseId) });
      await invalidateFinance(queryClient, projectId);
    },
  });
}

export function useExpenseAttachmentDownloadUrl(projectId: number, expenseId: number) {
  return useMutation({ mutationFn: (attachmentId: number) => expenseAttachmentsApi.downloadUrl(projectId, expenseId, attachmentId) });
}

export function useRemoveExpenseAttachment(projectId: number, expenseId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: number) => expenseAttachmentsApi.remove(projectId, expenseId, attachmentId),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: financeKeys.attachments(projectId, expenseId) }),
  });
}
