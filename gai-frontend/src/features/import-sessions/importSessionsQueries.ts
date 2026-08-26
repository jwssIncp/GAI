import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { importSessionsApi } from '@/api/endpoints';
import { uploadToPresignedUrl } from '@/api/http';
import { projectKeys } from '@/features/projects/projectQueries';
import type { ImportFileType, ImportPayloadInput, ImportSessionInput, ImportSessionStatus, PageParams } from '@/types/api';

export const importSessionKeys = {
  all: ['import-sessions'] as const,
  project: (projectId: number) => [...importSessionKeys.all, 'project', projectId] as const,
  list: (projectId: number, params: PageParams) => [...importSessionKeys.project(projectId), 'list', params] as const,
  detail: (projectId: number, sessionId?: number) => [...importSessionKeys.project(projectId), 'detail', sessionId] as const,
  payloads: (projectId: number, sessionId?: number, params?: PageParams) => [...importSessionKeys.detail(projectId, sessionId), 'payloads', params] as const,
  errors: (projectId: number, sessionId?: number, params?: PageParams) => [...importSessionKeys.detail(projectId, sessionId), 'errors', params] as const,
  files: (projectId: number, sessionId?: number) => [...importSessionKeys.detail(projectId, sessionId), 'files'] as const,
};

export function isImportSessionRunning(status?: ImportSessionStatus | string | null) {
  return status === 'open' || status === 'receiving' || status === 'processing';
}

export function useImportSessions(projectId: number, params: PageParams & { status?: ImportSessionStatus | string }) {
  return useQuery({
    queryKey: importSessionKeys.list(projectId, params),
    queryFn: () => importSessionsApi.list(projectId, params),
    enabled: Number.isFinite(projectId),
    refetchInterval: (query) => query.state.data?.items.some((item) => isImportSessionRunning(item.status)) ? 15000 : false,
  });
}

export function useImportSession(projectId: number, sessionId?: number) {
  return useQuery({
    queryKey: importSessionKeys.detail(projectId, sessionId),
    queryFn: () => importSessionsApi.get(projectId, sessionId!),
    enabled: Number.isFinite(projectId) && Boolean(sessionId),
    refetchInterval: (query) => isImportSessionRunning(query.state.data?.status) ? 15000 : false,
  });
}

export function useImportPayloads(projectId: number, sessionId?: number, params: PageParams = { page: 1, page_size: 10 }) {
  return useQuery({
    queryKey: importSessionKeys.payloads(projectId, sessionId, params),
    queryFn: () => importSessionsApi.payloads(projectId, sessionId!, params),
    enabled: Number.isFinite(projectId) && Boolean(sessionId),
  });
}

export function useImportErrors(projectId: number, sessionId?: number, params: PageParams = { page: 1, page_size: 10 }) {
  return useQuery({
    queryKey: importSessionKeys.errors(projectId, sessionId, params),
    queryFn: () => importSessionsApi.sessionErrors(projectId, sessionId!, params),
    enabled: Number.isFinite(projectId) && Boolean(sessionId),
  });
}

export function useImportFiles(projectId: number, sessionId?: number) {
  return useQuery({
    queryKey: importSessionKeys.files(projectId, sessionId),
    queryFn: () => importSessionsApi.files(projectId, sessionId!),
    enabled: Number.isFinite(projectId) && Boolean(sessionId),
  });
}

export function useCreateImportSession(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ImportSessionInput) => importSessionsApi.create(projectId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: importSessionKeys.project(projectId) });
      await queryClient.invalidateQueries({ queryKey: projectKeys.dashboard(projectId) });
    },
  });
}

export function useImportSessionAction(projectId: number, action: 'finish' | 'cancel' | 'retry') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: number) => {
      if (action === 'finish') return importSessionsApi.finish(projectId, sessionId);
      if (action === 'cancel') return importSessionsApi.cancel(projectId, sessionId);
      return importSessionsApi.retry(projectId, sessionId);
    },
    onSuccess: async (_, sessionId) => {
      await queryClient.invalidateQueries({ queryKey: importSessionKeys.project(projectId) });
      await queryClient.invalidateQueries({ queryKey: importSessionKeys.detail(projectId, sessionId) });
      await queryClient.invalidateQueries({ queryKey: projectKeys.dashboard(projectId) });
    },
  });
}

export function useCreateImportPayload(projectId: number, sessionId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ImportPayloadInput) => importSessionsApi.createPayload(projectId, sessionId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: importSessionKeys.detail(projectId, sessionId) });
    },
  });
}

export function useReprocessImportPayload(projectId: number, sessionId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payloadId: number) => importSessionsApi.reprocessPayload(projectId, sessionId, payloadId),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: importSessionKeys.detail(projectId, sessionId) }),
  });
}

export function useUploadImportFile(projectId: number, sessionId: number, type: ImportFileType, onProgress?: (progress: number) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const response = await importSessionsApi.createFileUploadUrl(projectId, sessionId, {
        type,
        original_name: file.name,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
      });
      await uploadToPresignedUrl(response.upload_url, file, onProgress);
      return importSessionsApi.confirmFileUpload(projectId, sessionId, response.file.id, { size_bytes: file.size });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: importSessionKeys.files(projectId, sessionId) });
      await queryClient.invalidateQueries({ queryKey: importSessionKeys.detail(projectId, sessionId) });
    },
  });
}

export function useImportFileDownloadUrl(projectId: number, sessionId: number) {
  return useMutation({ mutationFn: (fileId: number) => importSessionsApi.fileDownloadUrl(projectId, sessionId, fileId) });
}

export function useImportPhysicalObservations(projectId: number, sessionId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { file: File; payload_number: number; idempotency_key: string }) => importSessionsApi.importPhysicalObservations(projectId, sessionId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: importSessionKeys.detail(projectId, sessionId) });
      await queryClient.invalidateQueries({ queryKey: importSessionKeys.errors(projectId, sessionId) });
      await queryClient.invalidateQueries({ queryKey: importSessionKeys.payloads(projectId, sessionId) });
    },
  });
}
