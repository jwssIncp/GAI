import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { projectUnitsApi, projectsApi } from '@/api/endpoints';
import type { CreateProjectRequest, PageParams, ProjectLifecycleAction, ProjectStatus, UpdateProjectRequest } from '@/types/api';

export type ProjectListParams = PageParams & { status?: ProjectStatus | ''; organization_id?: number; company_id?: number };

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (params: ProjectListParams) => [...projectKeys.lists(), params] as const,
  detail: (id?: number) => [...projectKeys.all, 'detail', id] as const,
  dashboard: (id?: number) => [...projectKeys.all, 'dashboard', id] as const,
  units: (id?: number) => [...projectKeys.all, 'units', id] as const,
};

export async function invalidateProject(queryClient: QueryClient, projectId?: number) {
  const invalidations = [queryClient.invalidateQueries({ queryKey: projectKeys.lists() })];
  if (projectId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) }),
      queryClient.invalidateQueries({ queryKey: projectKeys.dashboard(projectId) }),
    );
  }
  await Promise.all(invalidations);
}

export function useProjects(params: ProjectListParams) {
  return useQuery({ queryKey: projectKeys.list(params), queryFn: () => projectsApi.list(params) });
}

export function useProject(projectId?: number) {
  return useQuery({
    queryKey: projectKeys.detail(projectId),
    queryFn: () => projectsApi.get(projectId!),
    enabled: Boolean(projectId && Number.isFinite(projectId)),
    retry: false,
  });
}

export function useProjectDashboard(projectId?: number) {
  return useQuery({
    queryKey: projectKeys.dashboard(projectId),
    queryFn: () => projectsApi.dashboard(projectId!),
    enabled: Boolean(projectId && Number.isFinite(projectId)),
    retry: false,
    refetchInterval: (query) => {
      const imports = query.state.data?.imports;
      return imports && (imports.open_import_sessions > 0 || imports.processing_import_sessions > 0) ? 15000 : false;
    },
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProjectRequest) => projectsApi.create(payload),
    onSuccess: async () => invalidateProject(queryClient),
  });
}

export function useUpdateProject(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateProjectRequest) => projectsApi.update(projectId, payload),
    onSuccess: async (project) => {
      queryClient.setQueryData(projectKeys.detail(projectId), project);
      await invalidateProject(queryClient, projectId);
    },
  });
}

export function useProjectLifecycleAction(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: ProjectLifecycleAction) => {
      if (action === 'activate') return projectsApi.activate(projectId);
      if (action === 'pause') return projectsApi.pause(projectId);
      if (action === 'resume') return projectsApi.resume(projectId);
      if (action === 'finish') return projectsApi.finish(projectId);
      if (action === 'cancel') return projectsApi.cancel(projectId);
      return projectsApi.archive(projectId);
    },
    onSuccess: async (project) => {
      queryClient.setQueryData(projectKeys.detail(projectId), project);
      await invalidateProject(queryClient, projectId);
    },
  });
}

export function useProjectUnits(projectId: number) {
  return useQuery({ queryKey: projectKeys.units(projectId), queryFn: () => projectUnitsApi.list(projectId), enabled: Number.isFinite(projectId) });
}

export function useAssignProjectUnit(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (companyUnitId: number) => projectUnitsApi.assign(projectId, companyUnitId),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: projectKeys.units(projectId) }),
  });
}

export function useRemoveProjectUnit(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (companyUnitId: number) => projectUnitsApi.remove(projectId, companyUnitId),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: projectKeys.units(projectId) }),
  });
}

