import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { organizationsApi } from '@/api/endpoints';
import type { CreateOrganizationRequest, OrganizationListParams, UpdateOrganizationRequest } from '@/types/api';

export const organizationKeys = {
  all: ['organizations'] as const,
  list: (params: OrganizationListParams) => [...organizationKeys.all, 'list', params] as const,
  detail: (id?: number) => [...organizationKeys.all, 'detail', id] as const,
};

export function useOrganizations(params: OrganizationListParams) {
  return useQuery({ queryKey: organizationKeys.list(params), queryFn: () => organizationsApi.list(params) });
}

export function useOrganization(id?: number) {
  return useQuery({ queryKey: organizationKeys.detail(id), queryFn: () => organizationsApi.get(id!), enabled: Boolean(id) });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOrganizationRequest) => organizationsApi.create(payload),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: organizationKeys.all }),
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateOrganizationRequest }) => organizationsApi.update(id, payload),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: organizationKeys.all });
      await queryClient.invalidateQueries({ queryKey: organizationKeys.detail(variables.id) });
    },
  });
}

export function useChangeOrganizationStatus(action: 'deactivate' | 'activate') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => organizationsApi[action](id),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: organizationKeys.all }),
  });
}
