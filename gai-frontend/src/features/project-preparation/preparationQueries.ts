import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/http';
import type {
  AnswerPayload,
  CommunicationPreview,
  Preparation,
  PreparationContext,
  PreparationHistory,
  PreparationMetadata,
  PreparationTemplate,
  TemplatePayload,
} from './preparationTypes';
const projectPath = (project: number) => `/projects/${project}/preparations`;
const templatePath = (org: number) =>
  `/organizations/${org}/preparation-templates`;
export const preparationKeys = {
  project: (id: number) => ['project-preparation', id] as const,
  templates: (org?: number) => ['preparation-templates', org] as const,
};
export const preparationApi = {
  context: (id: number) =>
    api
      .get<PreparationContext>(`${projectPath(id)}/context`)
      .then((r) => r.data),
  list: (id: number) =>
    api.get<{ items: Preparation[] }>(projectPath(id)).then((r) => r.data),
  get: (id: number, instance: number) =>
    api.get<Preparation>(`${projectPath(id)}/${instance}`).then((r) => r.data),
  create: (
    id: number,
    payload: PreparationMetadata & {
      template_id: number;
      template_version?: number;
    },
  ) => api.post<Preparation>(projectPath(id), payload).then((r) => r.data),
  update: (
    id: number,
    instance: number,
    payload: PreparationMetadata & { revision: number },
  ) =>
    api
      .patch<Preparation>(`${projectPath(id)}/${instance}`, payload)
      .then((r) => r.data),
  answers: (
    id: number,
    instance: number,
    revision: number,
    answers: AnswerPayload[],
  ) =>
    api
      .patch<Preparation>(`${projectPath(id)}/${instance}/answers`, {
        revision,
        answers,
      })
      .then((r) => r.data),
  transition: (
    id: number,
    instance: number,
    revision: number,
    action: 'approve' | 'reopen' | 'archive',
  ) =>
    action === 'archive'
      ? api
          .delete<Preparation>(`${projectPath(id)}/${instance}`, {
            data: { revision },
          })
          .then((r) => r.data)
      : api
          .post<Preparation>(`${projectPath(id)}/${instance}/${action}`, {
            revision,
          })
          .then((r) => r.data),
  history: (id: number, instance: number, before_id?: number) =>
    api
      .get<PreparationHistory>(`${projectPath(id)}/${instance}/history`, {
        params: { before_id },
      })
      .then((r) => r.data),
  communication: (
    id: number,
    instance: number,
    channel: 'email' | 'guidance',
  ) =>
    api
      .get<CommunicationPreview>(
        `${projectPath(id)}/${instance}/communication`,
        { params: { channel } },
      )
      .then((r) => r.data),
  templates: (org: number) =>
    api
      .get<{ items: PreparationTemplate[] }>(templatePath(org))
      .then((r) => r.data),
  template: (org: number, id: number) =>
    api
      .get<PreparationTemplate>(`${templatePath(org)}/${id}`)
      .then((r) => r.data),
  version: (org: number, id: number, version: number) =>
    api
      .get<{
        name: string;
        version: number;
        questions: TemplatePayload['questions'];
      }>(`${templatePath(org)}/${id}/versions/${version}`)
      .then((r) => r.data),
  createTemplate: (org: number, payload: TemplatePayload) =>
    api
      .post<PreparationTemplate>(templatePath(org), payload)
      .then((r) => r.data),
  updateTemplate: (
    org: number,
    id: number,
    payload: Omit<TemplatePayload, 'kind'> & { expected_version: number },
  ) =>
    api
      .patch<PreparationTemplate>(`${templatePath(org)}/${id}`, payload)
      .then((r) => r.data),
  cloneTemplate: (org: number, id: number) =>
    api
      .post<PreparationTemplate>(`${templatePath(org)}/${id}/clone`)
      .then((r) => r.data),
  archiveTemplate: (org: number, id: number, revision: number) =>
    api
      .delete<PreparationTemplate>(`${templatePath(org)}/${id}`, {
        data: { revision },
      })
      .then((r) => r.data),
};
export function usePreparationContext(projectId: number) {
  return useQuery({
    queryKey: [...preparationKeys.project(projectId), 'context'],
    queryFn: () => preparationApi.context(projectId),
    retry: false,
    enabled: Number.isSafeInteger(projectId) && projectId > 0,
  });
}
export function usePreparations(projectId: number) {
  return useQuery({
    queryKey: [...preparationKeys.project(projectId), 'list'],
    queryFn: () => preparationApi.list(projectId),
    retry: false,
    enabled: Number.isSafeInteger(projectId) && projectId > 0,
  });
}
export function usePreparation(projectId: number, id?: number) {
  return useQuery({
    queryKey: [...preparationKeys.project(projectId), 'detail', id],
    queryFn: () => preparationApi.get(projectId, id!),
    retry: false,
    enabled: Boolean(id),
  });
}
export function usePreparationTemplates(org?: number) {
  return useQuery({
    queryKey: preparationKeys.templates(org),
    queryFn: () => preparationApi.templates(org!),
    retry: false,
    enabled: Boolean(org),
  });
}
export function usePreparationMutation<T, TResult>(
  projectId: number,
  operation: (input: T) => Promise<TResult>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: operation,
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: preparationKeys.project(projectId),
      });
    },
  });
}
