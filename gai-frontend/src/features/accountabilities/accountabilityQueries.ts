import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { expenseAccountabilitiesApi, expensesApi } from '@/api/endpoints';
import type { ExpenseAccountabilityStatus, PageParams } from '@/types/api';

export const accountabilityKeys = {
  project: (projectId: number) => ['expense-accountabilities', projectId] as const,
  list: (projectId: number, params: object) => [...accountabilityKeys.project(projectId), 'list', params] as const,
  detail: (projectId: number, id: number) => [...accountabilityKeys.project(projectId), 'detail', id] as const,
  installments: (projectId: number, expenseId: number, params: object) => [...accountabilityKeys.project(projectId), 'installments', expenseId, params] as const,
};
export function useAccountabilities(projectId: number, params: PageParams & { field_agent_id?: number; status?: ExpenseAccountabilityStatus | ''; period_start?: string; period_end?: string }) { return useQuery({ queryKey: accountabilityKeys.list(projectId, params), queryFn: () => expenseAccountabilitiesApi.list(projectId, params), enabled: Number.isFinite(projectId) }); }
export function useAccountability(projectId: number, id?: number) { return useQuery({ queryKey: accountabilityKeys.detail(projectId, id ?? 0), queryFn: () => expenseAccountabilitiesApi.get(projectId, id!), enabled: Boolean(id) }); }
function useProjectMutation<T>(projectId: number, fn: (value: T) => Promise<unknown>) { const client = useQueryClient(); return useMutation({ mutationFn: fn, onSuccess: async () => { await client.invalidateQueries({ queryKey: accountabilityKeys.project(projectId) }); await client.invalidateQueries({ queryKey: ['expenses', projectId] }); } }); }
export function useCreateAccountability(projectId: number) { return useProjectMutation(projectId, (payload: { field_agent_id: number; period_start: string; period_end: string; notes?: string }) => expenseAccountabilitiesApi.create(projectId, payload)); }
export function useAddAccountabilityExpense(projectId: number) { return useProjectMutation(projectId, (value: { id: number; expenseId: number }) => expenseAccountabilitiesApi.addExpense(projectId, value.id, value.expenseId)); }
export function useCloseAccountability(projectId: number) { return useProjectMutation(projectId, (id: number) => expenseAccountabilitiesApi.close(projectId, id)); }
export function useEligibleExpenses(projectId: number, fieldAgentId?: number, start?: string, end?: string) { return useQuery({ queryKey: ['expenses', projectId, 'accountability-eligible', fieldAgentId, start, end], queryFn: () => expensesApi.list(projectId, { page: 1, page_size: 100, field_agent_id: fieldAgentId, start_date: start, end_date: end }), enabled: Boolean(fieldAgentId && start && end) }); }
export function useInstallments(projectId: number, expenseId?: number) { const params = { page: 1, page_size: 100 }; return useQuery({ queryKey: accountabilityKeys.installments(projectId, expenseId ?? 0, params), queryFn: () => expenseAccountabilitiesApi.listInstallments(projectId, expenseId!, params), enabled: Boolean(expenseId) }); }
export function useGenerateInstallments(projectId: number) { return useProjectMutation(projectId, (value: { expenseId: number; count: number; first_due_date: string; origin?: string }) => expenseAccountabilitiesApi.generateInstallments(projectId, value.expenseId, { count: value.count, first_due_date: value.first_due_date, origin: value.origin })); }
