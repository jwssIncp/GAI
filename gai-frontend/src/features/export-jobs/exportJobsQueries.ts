import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { exportJobsApi } from '@/api/endpoints';
import { projectKeys } from '@/features/projects/projectQueries';
import type { ExportJobStatus, ExportJobType, PageParams } from '@/types/api';

export type ExportJobListParams = PageParams & {
  type?: ExportJobType | '';
  status?: ExportJobStatus | '';
  requested_by_id?: number;
  date_from?: string;
  date_to?: string;
};

export const exportJobKeys = {
  all: ['export-jobs'] as const,
  project: (projectId: number) => [...exportJobKeys.all, 'project', projectId] as const,
  list: (projectId: number, params: ExportJobListParams) => [...exportJobKeys.project(projectId), 'list', params] as const,
  detail: (projectId: number, jobId?: number) => [...exportJobKeys.project(projectId), 'detail', jobId] as const,
};

export function useExportJobs(projectId: number, params: ExportJobListParams) {
  return useQuery({
    queryKey: exportJobKeys.list(projectId, params),
    queryFn: () => exportJobsApi.list(projectId, params),
    enabled: Number.isFinite(projectId),
    refetchInterval: (query) => query.state.data?.items.some((item) => item.status === 'pending' || item.status === 'processing') ? 15000 : false,
  });
}

function useInvalidateExportJobs(projectId: number) {
  const queryClient = useQueryClient();
  return async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: exportJobKeys.project(projectId) }),
    queryClient.invalidateQueries({ queryKey: projectKeys.dashboard(projectId) }),
  ]);
}

export function useCreateExportJob(projectId: number) {
  const invalidate = useInvalidateExportJobs(projectId);
  return useMutation({ mutationFn: (type: ExportJobType) => exportJobsApi.create(projectId, type), onSuccess: invalidate });
}

export function useCancelExportJob(projectId: number) {
  const invalidate = useInvalidateExportJobs(projectId);
  return useMutation({ mutationFn: (jobId: number) => exportJobsApi.cancel(projectId, jobId), onSuccess: invalidate });
}

export function useRetryExportJob(projectId: number) {
  const invalidate = useInvalidateExportJobs(projectId);
  return useMutation({ mutationFn: (jobId: number) => exportJobsApi.retry(projectId, jobId), onSuccess: invalidate });
}

export function useDownloadExportJob(projectId: number) {
  return useMutation({
    mutationFn: async (jobId: number) => {
      const authorized = await exportJobsApi.downloadUrl(projectId, jobId);
      const blob = await exportJobsApi.download(authorized.download_url);
      return { blob, job: authorized.job };
    },
  });
}
