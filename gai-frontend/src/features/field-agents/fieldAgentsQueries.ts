import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { uploadToPresignedUrl } from '@/api/http';
import { fieldAgentsApi, projectFieldAgentsApi } from '@/api/endpoints';
import { projectKeys } from '@/features/projects/projectQueries';
import type { AssignProjectFieldAgentRequest, CreateFieldAgentRequest, FieldAgentDocumentCategory, FieldAgentListParams, PageParams, UpdateFieldAgentRequest, UpdateProjectFieldAgentRequest } from '@/types/api';

export const fieldAgentKeys = {
  all: ['field-agents'] as const,
  list: (params: FieldAgentListParams) => [...fieldAgentKeys.all, 'list', params] as const,
  detail: (id?: number) => [...fieldAgentKeys.all, 'detail', id] as const,
  project: (projectId: number, params: PageParams) => ['project-field-agents', projectId, params] as const,
};

export function useFieldAgents(params: FieldAgentListParams) {
  return useQuery({ queryKey: fieldAgentKeys.list(params), queryFn: () => fieldAgentsApi.list(params) });
}

export function useFieldAgent(id?: number) {
  return useQuery({ queryKey: fieldAgentKeys.detail(id), queryFn: () => fieldAgentsApi.get(id!), enabled: Boolean(id) });
}

export function useCreateFieldAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateFieldAgentRequest) => fieldAgentsApi.create(payload),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: fieldAgentKeys.all }),
  });
}

export function useUpdateFieldAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateFieldAgentRequest }) => fieldAgentsApi.update(id, payload),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: fieldAgentKeys.all });
      await queryClient.invalidateQueries({ queryKey: fieldAgentKeys.detail(variables.id) });
    },
  });
}

export function useChangeFieldAgentStatus(action: 'deactivate' | 'reactivate' | 'block' | 'unblock' | 'restore') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fieldAgentsApi[action](id),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: fieldAgentKeys.all }),
  });
}

export function useDeleteFieldAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fieldAgentsApi.delete(id),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: fieldAgentKeys.all }),
  });
}

export function useProjectFieldAgents(projectId: number, params: PageParams) {
  return useQuery({ queryKey: fieldAgentKeys.project(projectId, params), queryFn: () => projectFieldAgentsApi.list(projectId, params), enabled: Number.isFinite(projectId) });
}

export function useAssignProjectFieldAgent(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AssignProjectFieldAgentRequest) => projectFieldAgentsApi.assign(projectId, payload),
    onSuccess: async () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['project-field-agents', projectId] }),
      queryClient.invalidateQueries({ queryKey: projectKeys.dashboard(projectId) }),
    ]),
  });
}

export function useRemoveProjectFieldAgent(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: number) => projectFieldAgentsApi.remove(projectId, assignmentId),
    onSuccess: async () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['project-field-agents', projectId] }),
      queryClient.invalidateQueries({ queryKey: projectKeys.dashboard(projectId) }),
    ]),
  });
}

export function useUpdateProjectFieldAgent(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assignmentId, payload }: { assignmentId: number; payload: UpdateProjectFieldAgentRequest }) =>
      projectFieldAgentsApi.update(projectId, assignmentId, payload),
    onSuccess: async () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['project-field-agents', projectId] }),
      queryClient.invalidateQueries({ queryKey: projectKeys.dashboard(projectId) }),
    ]),
  });
}

export function useFieldAgentSummary() {
  return useQuery({ queryKey: [...fieldAgentKeys.all, 'summary'] as const, queryFn: fieldAgentsApi.summary });
}

export function useBatchDeleteFieldAgents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => fieldAgentsApi.batchDelete(ids),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: fieldAgentKeys.all }),
  });
}

export const fieldAgentDocumentKeys = {
  list: (id: number) => [...fieldAgentKeys.all, 'documents', id] as const,
};

export function useFieldAgentDocuments(id: number, enabled = true) {
  return useQuery({ queryKey: fieldAgentDocumentKeys.list(id), queryFn: () => fieldAgentsApi.documents(id), enabled });
}

/** Envia um documento: pede a URL assinada, sobe o arquivo e confirma no servidor. */
export async function uploadFieldAgentDocument(id: number, file: File, category: FieldAgentDocumentCategory) {
  const response = await fieldAgentsApi.documentUploadUrl(id, {
    original_name: file.name,
    mime_type: file.type || 'application/octet-stream',
    size_bytes: file.size,
    category,
  });
  await uploadToPresignedUrl(response.upload_url, file);
  return fieldAgentsApi.confirmDocument(id, response.document.id, { size_bytes: file.size });
}

export function useUploadFieldAgentDocument(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, category }: { file: File; category: FieldAgentDocumentCategory }) =>
      uploadFieldAgentDocument(id, file, category),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: fieldAgentDocumentKeys.list(id) }),
  });
}

export function useRemoveFieldAgentDocument(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: number) => fieldAgentsApi.removeDocument(id, documentId),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: fieldAgentDocumentKeys.list(id) }),
  });
}
