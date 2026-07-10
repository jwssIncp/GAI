import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fieldAgentsApi, projectFieldAgentsApi } from '@/api/endpoints';
import type { AssignProjectFieldAgentRequest, CreateFieldAgentRequest, PageParams, UpdateFieldAgentRequest } from '@/types/api';

export const fieldAgentKeys = {
  all: ['field-agents'] as const,
  list: (params: PageParams) => [...fieldAgentKeys.all, 'list', params] as const,
  detail: (id?: number) => [...fieldAgentKeys.all, 'detail', id] as const,
  project: (projectId: number, params: PageParams) => ['project-field-agents', projectId, params] as const,
};

export function useFieldAgents(params: PageParams) {
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

export function useChangeFieldAgentStatus(action: 'deactivate' | 'reactivate') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => (action === 'deactivate' ? fieldAgentsApi.deactivate(id) : fieldAgentsApi.reactivate(id)),
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
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['project-field-agents', projectId] }),
  });
}

export function useRemoveProjectFieldAgent(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: number) => projectFieldAgentsApi.remove(projectId, assignmentId),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['project-field-agents', projectId] }),
  });
}
