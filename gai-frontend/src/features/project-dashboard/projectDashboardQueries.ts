import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { projectsApi } from '@/api/endpoints';
import type { ProjectDashboardParams } from '@/types/api';

export const projectDashboardKeys = {
  all: ['project-dashboard-analytics'] as const,
  project: (projectId: number | undefined) => [...projectDashboardKeys.all, projectId] as const,
  detail: (projectId: number | undefined, params: ProjectDashboardParams) =>
    [...projectDashboardKeys.project(projectId), params] as const,
};

export function useProjectDashboardAnalytics(
  projectId: number | undefined,
  params: ProjectDashboardParams,
) {
  return useQuery({
    queryKey: projectDashboardKeys.detail(projectId, params),
    queryFn: () => projectsApi.dashboardAnalytics(projectId!, params),
    enabled: Boolean(projectId && Number.isFinite(projectId)),
    placeholderData: keepPreviousData,
    retry: false,
  });
}
