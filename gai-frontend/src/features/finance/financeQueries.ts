import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { expenseAttachmentsApi, expensesApi, fieldAgentsApi, paymentsApi } from '@/api/endpoints';
import { uploadToPresignedUrl } from '@/api/http';
import type {
  ExpenseInput,
  ExpenseStatus,
  MarkAsPaidRequest,
  PageParams,
  PaymentInput,
  PaymentStatus,
  RejectExpenseRequest,
} from '@/types/api';

export const financeKeys = {
  all: ['finance'] as const,
  project: (projectId: number) => [...financeKeys.all, 'project', projectId] as const,
  payments: (projectId: number, params: PageParams) => [...financeKeys.project(projectId), 'payments', params] as const,
  paymentSummary: (projectId: number) => [...financeKeys.project(projectId), 'payment-summary'] as const,
  expenses: (projectId: number, params: PageParams) => [...financeKeys.project(projectId), 'expenses', params] as const,
  attachments: (projectId: number, expenseId?: number) => [...financeKeys.project(projectId), 'expense-attachments', expenseId] as const,
};

export function useFinanceFieldAgents() {
  return useQuery({ queryKey: ['field-agents', 'finance-select'], queryFn: () => fieldAgentsApi.list({ page: 1, page_size: 100, status: 'active' }) });
}

export function usePayments(projectId: number, params: PageParams & { field_agent_id?: number; status?: PaymentStatus | string; state?: string; start_date?: string; end_date?: string; payment_date?: string }) {
  return useQuery({ queryKey: financeKeys.payments(projectId, params), queryFn: () => paymentsApi.list(projectId, params), enabled: Number.isFinite(projectId) });
}

export function usePaymentSummary(projectId: number) {
  return useQuery({ queryKey: financeKeys.paymentSummary(projectId), queryFn: () => paymentsApi.summary(projectId), enabled: Number.isFinite(projectId) });
}

export function useExpenses(projectId: number, params: PageParams & { field_agent_id?: number; status?: ExpenseStatus | string; start_date?: string; end_date?: string }) {
  return useQuery({ queryKey: financeKeys.expenses(projectId, params), queryFn: () => expensesApi.list(projectId, params), enabled: Number.isFinite(projectId) });
}

function invalidateFinance(queryClient: ReturnType<typeof useQueryClient>, projectId: number) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: financeKeys.project(projectId) }),
    queryClient.invalidateQueries({ queryKey: ['project-summary', projectId] }),
  ]);
}

export function useCreatePayment(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PaymentInput) => paymentsApi.create(projectId, payload),
    onSuccess: async () => void await invalidateFinance(queryClient, projectId),
  });
}

export function useUpdatePayment(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: PaymentInput }) => paymentsApi.update(projectId, id, payload),
    onSuccess: async () => void await invalidateFinance(queryClient, projectId),
  });
}

export function usePaymentAction(projectId: number, action: 'approve' | 'mark-as-paid' | 'cancel') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload?: MarkAsPaidRequest }) => {
      if (action === 'approve') return paymentsApi.approve(projectId, id);
      if (action === 'mark-as-paid') return paymentsApi.markAsPaid(projectId, id, payload);
      return paymentsApi.cancel(projectId, id);
    },
    onSuccess: async () => void await invalidateFinance(queryClient, projectId),
  });
}

export function useCreateExpense(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ExpenseInput) => expensesApi.create(projectId, payload),
    onSuccess: async () => void await invalidateFinance(queryClient, projectId),
  });
}

export function useUpdateExpense(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ExpenseInput }) => expensesApi.update(projectId, id, payload),
    onSuccess: async () => void await invalidateFinance(queryClient, projectId),
  });
}

export function useExpenseAction(projectId: number, action: 'approve' | 'reject' | 'mark-as-paid' | 'cancel') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload?: RejectExpenseRequest }) => {
      if (action === 'approve') return expensesApi.approve(projectId, id);
      if (action === 'reject') return expensesApi.reject(projectId, id, payload ?? { reason: '' });
      if (action === 'mark-as-paid') return expensesApi.markAsPaid(projectId, id);
      return expensesApi.cancel(projectId, id);
    },
    onSuccess: async () => void await invalidateFinance(queryClient, projectId),
  });
}

export function useExpenseAttachments(projectId: number, expenseId?: number) {
  return useQuery({
    queryKey: financeKeys.attachments(projectId, expenseId),
    queryFn: () => expenseAttachmentsApi.list(projectId, expenseId!),
    enabled: Number.isFinite(projectId) && Boolean(expenseId),
  });
}

export function useUploadExpenseAttachment(projectId: number, expenseId: number, onProgress?: (progress: number) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const response = await expenseAttachmentsApi.createUploadUrl(projectId, expenseId, {
        original_name: file.name,
        mime_type: file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf',
        size_bytes: file.size,
      });
      await uploadToPresignedUrl(response.upload_url, file, onProgress);
      return expenseAttachmentsApi.confirmUpload(projectId, expenseId, response.attachment.id, { size_bytes: file.size });
    },
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
