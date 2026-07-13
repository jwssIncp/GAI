import { api } from './http';
import type {
  AccountingImportBatch,
  AccountingImportError,
  Company,
  CreateCompanyRequest,
  CreateFieldAgentRequest,
  CreateExpenseAttachmentUploadRequest,
  CreateInventoryItemImageUploadRequest,
  CreateOrganizationRequest,
  CreateProjectRequest,
  CreateUserRequest,
  CurrentUser,
  ConfirmExpenseAttachmentUploadRequest,
  ConfirmImportFileUploadRequest,
  FieldAgent,
  ConfirmInventoryItemImageUploadRequest,
  InventoryItem,
  InventoryItemImage,
  InventoryItemImageDownloadUrlResponse,
  InventoryItemImageUploadUrlResponse,
  InventoryAccountingItem,
  InventoryAccountingItemInput,
  InventoryAccountingItemStatus,
  CreateInventoryPendingIssueRequest,
  GenerateInventoryPendingIssuesResponse,
  FieldAgentPayment,
  PaymentInput,
  PaymentStatus,
  PaymentSummary,
  MarkAsPaidRequest,
  Expense,
  ExpenseInput,
  ExpenseStatus,
  ExpenseAttachment,
  ExpenseAttachmentDownloadUrlResponse,
  ExpenseAttachmentUploadUrlResponse,
  CreateImportFileUploadRequest,
  ImportFile,
  ImportFileDownloadUrlResponse,
  ImportFileUploadUrlResponse,
  ImportPayload,
  ImportPayloadError,
  ImportPayloadInput,
  ImportSession,
  ImportSessionInput,
  ImportSessionStatus,
  RejectExpenseRequest,
  InventoryPendingIssue,
  InventoryPendingIssueInput,
  InventoryPendingIssueSeverity,
  InventoryPendingIssueStatus,
  InventoryPendingIssueType,
  ResolveInventoryPendingIssueRequest,
  InventoryItemInput,
  AssignProjectFieldAgentRequest,
  LoginRequest,
  LoginResponse,
  OrgRole,
  Organization,
  PageParams,
  PaginatedItems,
  Permission,
  Project,
  ProjectFieldAgent,
  ProjectSummary,
  UpdateFieldAgentRequest,
  UpdateProjectFieldAgentRequest,
  User,
  MetaPaginated,
} from '@/types/api';

export const authApi = {
  login: (payload: LoginRequest) => api.post<LoginResponse>('/auth/login', payload).then((r) => r.data),
  logout: () => api.post<void>('/auth/logout').then((r) => r.data),
  me: () => api.get<CurrentUser>('/auth/me').then((r) => r.data),
  requestPasswordReset: (email: string) => api.post<{ message: string }>('/auth/password-reset/request', { email }).then((r) => r.data),
  confirmPasswordReset: (token: string, new_password: string) =>
    api.post<{ message: string }>('/auth/password-reset/confirm', { token, new_password }).then((r) => r.data),
};

export const organizationsApi = {
  list: (params: PageParams) => api.get<PaginatedItems<Organization>>('/organizations', { params }).then((r) => r.data),
  create: (payload: CreateOrganizationRequest) => api.post<Organization>('/organizations', payload).then((r) => r.data),
  get: (id: string) => api.get<Organization>(`/organizations/${id}`).then((r) => r.data),
  update: (id: string, payload: Partial<CreateOrganizationRequest>) => api.patch<Organization>(`/organizations/${id}`, payload).then((r) => r.data),
  deactivate: (id: string) => api.post<Organization>(`/organizations/${id}/deactivate`).then((r) => r.data),
  activate: (id: string) => api.post<Organization>(`/organizations/${id}/activate`).then((r) => r.data),
};

export const usersApi = {
  list: (params: PageParams & { role?: string }) => api.get<MetaPaginated<User>>('/users', { params }).then((r) => r.data),
  create: (payload: CreateUserRequest) => api.post<User>('/users', payload).then((r) => r.data),
  get: (id: number) => api.get<User>(`/users/${id}`).then((r) => r.data),
  update: (id: number, payload: Partial<CreateUserRequest>) => api.patch<User>(`/users/${id}`, payload).then((r) => r.data),
  deactivate: (id: number) => api.post<User>(`/users/${id}/deactivate`).then((r) => r.data),
  activate: (id: number) => api.post<User>(`/users/${id}/activate`).then((r) => r.data),
  assignments: (userId: number) => api.get(`/users/${userId}/role-assignments`).then((r) => r.data),
  assignRole: (userId: number, role_id: number) => api.post(`/users/${userId}/role-assignments`, { role_id }).then((r) => r.data),
  revokeRole: (userId: number, assignmentId: number) => api.delete(`/users/${userId}/role-assignments/${assignmentId}`),
};

export const rbacApi = {
  permissions: () => api.get<Permission[]>('/permissions').then((r) => r.data),
  roles: (organizationId: number) => api.get<OrgRole[]>(`/organizations/${organizationId}/roles`).then((r) => r.data),
  createRole: (organizationId: number, payload: { name: string; description?: string; permission_ids: number[] }) =>
    api.post<OrgRole>(`/organizations/${organizationId}/roles`, payload).then((r) => r.data),
  updateRole: (organizationId: number, roleId: number, payload: { name?: string; description?: string; permission_ids?: number[]; is_active?: boolean }) =>
    api.patch<OrgRole>(`/organizations/${organizationId}/roles/${roleId}`, payload).then((r) => r.data),
};

export const companiesApi = {
  list: (params: PageParams & { document?: string; city?: string; state?: string }) => api.get<PaginatedItems<Company>>('/companies', { params }).then((r) => r.data),
  create: (payload: CreateCompanyRequest) => api.post<Company>('/companies', payload).then((r) => r.data),
  get: (id: number) => api.get<Company>(`/companies/${id}`).then((r) => r.data),
  update: (id: number, payload: Partial<CreateCompanyRequest>) => api.patch<Company>(`/companies/${id}`, payload).then((r) => r.data),
  deactivate: (id: number) => api.post<Company>(`/companies/${id}/deactivate`).then((r) => r.data),
  reactivate: (id: number) => api.post<Company>(`/companies/${id}/reactivate`).then((r) => r.data),
};

export const projectsApi = {
  list: (params: PageParams) => api.get<PaginatedItems<Project>>('/projects', { params }).then((r) => r.data),
  create: (payload: CreateProjectRequest) => api.post<Project>('/projects', payload).then((r) => r.data),
  get: (id: number) => api.get<Project>(`/projects/${id}`).then((r) => r.data),
  update: (id: number, payload: Partial<CreateProjectRequest>) => api.patch<Project>(`/projects/${id}`, payload).then((r) => r.data),
  deactivate: (id: number) => api.post<Project>(`/projects/${id}/deactivate`).then((r) => r.data),
  reactivate: (id: number) => api.post<Project>(`/projects/${id}/reactivate`).then((r) => r.data),
  finish: (id: number) => api.post<Project>(`/projects/${id}/finish`).then((r) => r.data),
  cancel: (id: number) => api.post<Project>(`/projects/${id}/cancel`).then((r) => r.data),
  archive: (id: number) => api.post<Project>(`/projects/${id}/archive`).then((r) => r.data),
  summary: (projectId: number) =>
    api
      .get<ProjectSummary>(`/projects/${projectId}/summary`, {
        params: { include_financial: true, include_imports: true, include_exports: true, include_recent_activity: true },
      })
      .then((r) => r.data),
  dashboard: (projectId: number) =>
    api
      .get<ProjectSummary>(`/projects/${projectId}/dashboard`, {
        params: { include_financial: true, include_imports: true, include_exports: true, include_recent_activity: true },
      })
      .then((r) => r.data),
};

export const fieldAgentsApi = {
  list: (params: PageParams) => api.get<PaginatedItems<FieldAgent>>('/field-agents', { params }).then((r) => r.data),
  create: (payload: CreateFieldAgentRequest) => api.post<FieldAgent>('/field-agents', payload).then((r) => r.data),
  get: (id: number) => api.get<FieldAgent>(`/field-agents/${id}`).then((r) => r.data),
  update: (id: number, payload: UpdateFieldAgentRequest) => api.patch<FieldAgent>(`/field-agents/${id}`, payload).then((r) => r.data),
  deactivate: (id: number) => api.post<FieldAgent>(`/field-agents/${id}/deactivate`).then((r) => r.data),
  reactivate: (id: number) => api.post<FieldAgent>(`/field-agents/${id}/reactivate`).then((r) => r.data),
  block: (id: number) => api.post<FieldAgent>(`/field-agents/${id}/block`).then((r) => r.data),
  unblock: (id: number) => api.post<FieldAgent>(`/field-agents/${id}/unblock`).then((r) => r.data),
  delete: (id: number) => api.delete<void>(`/field-agents/${id}`).then((r) => r.data),
};

export const projectFieldAgentsApi = {
  list: (projectId: number, params: PageParams) =>
    api.get<PaginatedItems<ProjectFieldAgent>>(`/projects/${projectId}/field-agents`, { params }).then((r) => r.data),
  assign: (projectId: number, payload: AssignProjectFieldAgentRequest) =>
    api.post<ProjectFieldAgent>(`/projects/${projectId}/field-agents`, payload).then((r) => r.data),
  update: (projectId: number, assignmentId: number, payload: UpdateProjectFieldAgentRequest) =>
    api.patch<ProjectFieldAgent>(`/projects/${projectId}/field-agents/${assignmentId}`, payload).then((r) => r.data),
  remove: (projectId: number, assignmentId: number) =>
    api.post<ProjectFieldAgent>(`/projects/${projectId}/field-agents/${assignmentId}/remove`).then((r) => r.data),
};

export const inventoryItemsApi = {
  listByProject: (projectId: number, params: PageParams & { old_plate?: string; new_plate?: string; description?: string }) =>
    api.get<PaginatedItems<InventoryItem>>(`/projects/${projectId}/inventory-items`, { params }).then((r) => r.data),
  create: (projectId: number, payload: InventoryItemInput) =>
    api.post<InventoryItem>(`/projects/${projectId}/inventory-items`, payload).then((r) => r.data),
  getByProject: (projectId: number, id: number) =>
    api.get<InventoryItem>(`/projects/${projectId}/inventory-items/${id}`).then((r) => r.data),
  update: (projectId: number, id: number, payload: InventoryItemInput) =>
    api.patch<InventoryItem>(`/projects/${projectId}/inventory-items/${id}`, payload).then((r) => r.data),
  deactivate: (projectId: number, id: number) =>
    api.post<InventoryItem>(`/projects/${projectId}/inventory-items/${id}/deactivate`).then((r) => r.data),
  reactivate: (projectId: number, id: number) =>
    api.post<InventoryItem>(`/projects/${projectId}/inventory-items/${id}/reactivate`).then((r) => r.data),
  listGlobal: (params: PageParams & { project_id?: number; old_plate?: string; new_plate?: string; description?: string }) =>
    api.get<PaginatedItems<InventoryItem>>('/inventory-items', { params }).then((r) => r.data),
  getGlobal: (id: number) => api.get<InventoryItem>(`/inventory-items/${id}`).then((r) => r.data),
};

export const inventoryItemImagesApi = {
  list: (projectId: number, itemId: number, params: PageParams) =>
    api.get<PaginatedItems<InventoryItemImage>>(`/projects/${projectId}/inventory-items/${itemId}/images`, { params }).then((r) => r.data),
  createUploadUrl: (projectId: number, itemId: number, payload: CreateInventoryItemImageUploadRequest) =>
    api.post<InventoryItemImageUploadUrlResponse>(`/projects/${projectId}/inventory-items/${itemId}/images/upload-url`, payload).then((r) => r.data),
  get: (projectId: number, itemId: number, imageId: number) =>
    api.get<InventoryItemImage>(`/projects/${projectId}/inventory-items/${itemId}/images/${imageId}`).then((r) => r.data),
  confirmUpload: (projectId: number, itemId: number, imageId: number, payload?: ConfirmInventoryItemImageUploadRequest) =>
    api.post<InventoryItemImage>(`/projects/${projectId}/inventory-items/${itemId}/images/${imageId}/confirm-upload`, payload ?? {}).then((r) => r.data),
  downloadUrl: (projectId: number, itemId: number, imageId: number) =>
    api.post<InventoryItemImageDownloadUrlResponse>(`/projects/${projectId}/inventory-items/${itemId}/images/${imageId}/download-url`).then((r) => r.data),
  remove: (projectId: number, itemId: number, imageId: number) =>
    api.post<InventoryItemImage>(`/projects/${projectId}/inventory-items/${itemId}/images/${imageId}/remove`).then((r) => r.data),
};

export const accountingItemsApi = {
  list: (projectId: number, params: PageParams & { plate?: string; base_code?: string; investor_code?: string; description?: string; status?: InventoryAccountingItemStatus | string }) =>
    api.get<PaginatedItems<InventoryAccountingItem>>(`/projects/${projectId}/inventory-accounting-items`, { params }).then((r) => r.data),
  get: (projectId: number, id: number) =>
    api.get<InventoryAccountingItem>(`/projects/${projectId}/inventory-accounting-items/${id}`).then((r) => r.data),
  update: (projectId: number, id: number, payload: InventoryAccountingItemInput) =>
    api.patch<InventoryAccountingItem>(`/projects/${projectId}/inventory-accounting-items/${id}`, payload).then((r) => r.data),
  deactivate: (projectId: number, id: number) =>
    api.post<InventoryAccountingItem>(`/projects/${projectId}/inventory-accounting-items/${id}/deactivate`).then((r) => r.data),
  reactivate: (projectId: number, id: number) =>
    api.post<InventoryAccountingItem>(`/projects/${projectId}/inventory-accounting-items/${id}/reactivate`).then((r) => r.data),
};

export const accountingImportsApi = {
  importFile: (projectId: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post<AccountingImportBatch>(`/projects/${projectId}/accounting-imports`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data);
  },
  list: (projectId: number, params: PageParams) =>
    api.get<PaginatedItems<AccountingImportBatch>>(`/projects/${projectId}/accounting-imports`, { params }).then((r) => r.data),
  get: (projectId: number, batchId: number) =>
    api.get<AccountingImportBatch>(`/projects/${projectId}/accounting-imports/${batchId}`).then((r) => r.data),
  errors: (projectId: number, batchId: number) =>
    api.get<{ items: AccountingImportError[] }>(`/projects/${projectId}/accounting-imports/${batchId}/errors`).then((r) => r.data),
};

export const pendingIssuesApi = {
  list: (projectId: number, params: PageParams & {
    type?: InventoryPendingIssueType | string;
    status?: InventoryPendingIssueStatus | string;
    severity?: InventoryPendingIssueSeverity | string;
    inventory_item_id?: number;
    accounting_item_id?: number;
    plate?: string;
  }) => api.get<PaginatedItems<InventoryPendingIssue>>(`/projects/${projectId}/pending-issues`, { params }).then((r) => r.data),
  create: (projectId: number, payload: CreateInventoryPendingIssueRequest) =>
    api.post<InventoryPendingIssue>(`/projects/${projectId}/pending-issues`, payload).then((r) => r.data),
  get: (projectId: number, id: number) =>
    api.get<InventoryPendingIssue>(`/projects/${projectId}/pending-issues/${id}`).then((r) => r.data),
  update: (projectId: number, id: number, payload: InventoryPendingIssueInput) =>
    api.patch<InventoryPendingIssue>(`/projects/${projectId}/pending-issues/${id}`, payload).then((r) => r.data),
  resolve: (projectId: number, id: number, payload: ResolveInventoryPendingIssueRequest) =>
    api.post<InventoryPendingIssue>(`/projects/${projectId}/pending-issues/${id}/resolve`, payload).then((r) => r.data),
  ignore: (projectId: number, id: number, payload: ResolveInventoryPendingIssueRequest) =>
    api.post<InventoryPendingIssue>(`/projects/${projectId}/pending-issues/${id}/ignore`, payload).then((r) => r.data),
  cancel: (projectId: number, id: number) =>
    api.post<InventoryPendingIssue>(`/projects/${projectId}/pending-issues/${id}/cancel`).then((r) => r.data),
  generate: (projectId: number) =>
    api.post<GenerateInventoryPendingIssuesResponse>(`/projects/${projectId}/pending-issues/generate`).then((r) => r.data),
};

export const paymentsApi = {
  list: (projectId: number, params: PageParams & {
    field_agent_id?: number;
    status?: PaymentStatus | string;
    state?: string;
    start_date?: string;
    end_date?: string;
    payment_date?: string;
  }) => api.get<PaginatedItems<FieldAgentPayment>>(`/projects/${projectId}/payments`, { params }).then((r) => r.data),
  create: (projectId: number, payload: PaymentInput) =>
    api.post<FieldAgentPayment>(`/projects/${projectId}/payments`, payload).then((r) => r.data),
  get: (projectId: number, id: number) =>
    api.get<FieldAgentPayment>(`/projects/${projectId}/payments/${id}`).then((r) => r.data),
  update: (projectId: number, id: number, payload: PaymentInput) =>
    api.patch<FieldAgentPayment>(`/projects/${projectId}/payments/${id}`, payload).then((r) => r.data),
  approve: (projectId: number, id: number) =>
    api.post<FieldAgentPayment>(`/projects/${projectId}/payments/${id}/approve`).then((r) => r.data),
  markAsPaid: (projectId: number, id: number, payload?: MarkAsPaidRequest) =>
    api.post<FieldAgentPayment>(`/projects/${projectId}/payments/${id}/mark-as-paid`, payload ?? {}).then((r) => r.data),
  cancel: (projectId: number, id: number) =>
    api.post<FieldAgentPayment>(`/projects/${projectId}/payments/${id}/cancel`).then((r) => r.data),
  summary: (projectId: number) =>
    api.get<PaymentSummary>(`/projects/${projectId}/payments/summary`).then((r) => r.data),
};

export const expensesApi = {
  list: (projectId: number, params: PageParams & {
    field_agent_id?: number;
    status?: ExpenseStatus | string;
    start_date?: string;
    end_date?: string;
  }) => api.get<PaginatedItems<Expense>>(`/projects/${projectId}/expenses`, { params }).then((r) => r.data),
  create: (projectId: number, payload: ExpenseInput) =>
    api.post<Expense>(`/projects/${projectId}/expenses`, payload).then((r) => r.data),
  get: (projectId: number, id: number) =>
    api.get<Expense>(`/projects/${projectId}/expenses/${id}`).then((r) => r.data),
  update: (projectId: number, id: number, payload: ExpenseInput) =>
    api.patch<Expense>(`/projects/${projectId}/expenses/${id}`, payload).then((r) => r.data),
  approve: (projectId: number, id: number) =>
    api.post<Expense>(`/projects/${projectId}/expenses/${id}/approve`).then((r) => r.data),
  reject: (projectId: number, id: number, payload: RejectExpenseRequest) =>
    api.post<Expense>(`/projects/${projectId}/expenses/${id}/reject`, payload).then((r) => r.data),
  markAsPaid: (projectId: number, id: number) =>
    api.post<Expense>(`/projects/${projectId}/expenses/${id}/mark-as-paid`).then((r) => r.data),
  cancel: (projectId: number, id: number) =>
    api.post<Expense>(`/projects/${projectId}/expenses/${id}/cancel`).then((r) => r.data),
};

export const expenseAttachmentsApi = {
  createUploadUrl: (projectId: number, expenseId: number, payload: CreateExpenseAttachmentUploadRequest) =>
    api.post<ExpenseAttachmentUploadUrlResponse>(`/projects/${projectId}/expenses/${expenseId}/attachments/upload-url`, payload).then((r) => r.data),
  confirmUpload: (projectId: number, expenseId: number, attachmentId: number, payload?: ConfirmExpenseAttachmentUploadRequest) =>
    api.post<ExpenseAttachment>(`/projects/${projectId}/expenses/${expenseId}/attachments/${attachmentId}/confirm-upload`, payload ?? {}).then((r) => r.data),
  list: (projectId: number, expenseId: number) =>
    api.get<ExpenseAttachment[]>(`/projects/${projectId}/expenses/${expenseId}/attachments`).then((r) => r.data),
  downloadUrl: (projectId: number, expenseId: number, attachmentId: number) =>
    api.post<ExpenseAttachmentDownloadUrlResponse>(`/projects/${projectId}/expenses/${expenseId}/attachments/${attachmentId}/download-url`).then((r) => r.data),
  remove: (projectId: number, expenseId: number, attachmentId: number) =>
    api.post<ExpenseAttachment>(`/projects/${projectId}/expenses/${expenseId}/attachments/${attachmentId}/remove`).then((r) => r.data),
};

export const importSessionsApi = {
  list: (projectId: number, params: PageParams & { status?: ImportSessionStatus | string }) =>
    api.get<PaginatedItems<ImportSession>>(`/projects/${projectId}/import-sessions`, { params }).then((r) => r.data),
  create: (projectId: number, payload: ImportSessionInput) =>
    api.post<ImportSession>(`/projects/${projectId}/import-sessions`, payload).then((r) => r.data),
  get: (projectId: number, sessionId: number) =>
    api.get<ImportSession>(`/projects/${projectId}/import-sessions/${sessionId}`).then((r) => r.data),
  getByUuid: (projectId: number, sessionUuid: string) =>
    api.get<ImportSession>(`/projects/${projectId}/import-sessions/by-uuid/${sessionUuid}`).then((r) => r.data),
  finish: (projectId: number, sessionId: number) =>
    api.post<ImportSession>(`/projects/${projectId}/import-sessions/${sessionId}/finish`).then((r) => r.data),
  cancel: (projectId: number, sessionId: number) =>
    api.post<ImportSession>(`/projects/${projectId}/import-sessions/${sessionId}/cancel`).then((r) => r.data),
  retry: (projectId: number, sessionId: number) =>
    api.post<ImportSession>(`/projects/${projectId}/import-sessions/${sessionId}/retry`).then((r) => r.data),
  createPayload: (projectId: number, sessionId: number, payload: ImportPayloadInput) =>
    api.post<ImportPayload>(`/projects/${projectId}/import-sessions/${sessionId}/payloads`, payload).then((r) => r.data),
  payloads: (projectId: number, sessionId: number, params: PageParams) =>
    api.get<PaginatedItems<ImportPayload>>(`/projects/${projectId}/import-sessions/${sessionId}/payloads`, { params }).then((r) => r.data),
  getPayload: (projectId: number, sessionId: number, payloadId: number) =>
    api.get<ImportPayload>(`/projects/${projectId}/import-sessions/${sessionId}/payloads/${payloadId}`).then((r) => r.data),
  reprocessPayload: (projectId: number, sessionId: number, payloadId: number) =>
    api.post<ImportPayload>(`/projects/${projectId}/import-sessions/${sessionId}/payloads/${payloadId}/reprocess`).then((r) => r.data),
  sessionErrors: (projectId: number, sessionId: number, params: PageParams) =>
    api.get<PaginatedItems<ImportPayloadError>>(`/projects/${projectId}/import-sessions/${sessionId}/errors`, { params }).then((r) => r.data),
  payloadErrors: (projectId: number, sessionId: number, payloadId: number, params: PageParams) =>
    api.get<PaginatedItems<ImportPayloadError>>(`/projects/${projectId}/import-sessions/${sessionId}/payloads/${payloadId}/errors`, { params }).then((r) => r.data),
  createFileUploadUrl: (projectId: number, sessionId: number, payload: CreateImportFileUploadRequest) =>
    api.post<ImportFileUploadUrlResponse>(`/projects/${projectId}/import-sessions/${sessionId}/files/upload-url`, payload).then((r) => r.data),
  confirmFileUpload: (projectId: number, sessionId: number, fileId: number, payload?: ConfirmImportFileUploadRequest) =>
    api.post<ImportFile>(`/projects/${projectId}/import-sessions/${sessionId}/files/${fileId}/confirm-upload`, payload ?? {}).then((r) => r.data),
  files: (projectId: number, sessionId: number) =>
    api.get<ImportFile[]>(`/projects/${projectId}/import-sessions/${sessionId}/files`).then((r) => r.data),
  fileDownloadUrl: (projectId: number, sessionId: number, fileId: number) =>
    api.post<ImportFileDownloadUrlResponse>(`/projects/${projectId}/import-sessions/${sessionId}/files/${fileId}/download-url`).then((r) => r.data),
};
