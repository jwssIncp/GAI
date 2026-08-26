export type ErrorCode = string;

export type ApiValidationDetail = { field: string; message: string };

export type ApiErrorResponse = {
  code: ErrorCode;
  message: string;
  details?: unknown;
};

export type PageParams = {
  page?: number;
  page_size?: number;
  search?: string;
  status?: string;
  organization_id?: number;
  company_id?: number;
};

export type PaginatedItems<T> = {
  items: T[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
};

export type MetaPaginated<T> = {
  data: T[];
  meta: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
};

export type NormalizedPage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type RoleType = 'SYSTEM' | 'ORGANIZATION';
export type SystemRoleKey = 'PLATFORM_ADMIN' | 'ORG_ADMIN' | 'ORG_USER';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED';

export type RoleAssignment = {
  assignment_id: number;
  role_id: number;
  role_key?: SystemRoleKey | string | null;
  role_name: string;
  role_type: RoleType;
  organization_id?: number | null;
  assigned_at: string;
};

export type EffectivePermission = {
  key: string;
  scope: 'PLATFORM' | 'ORGANIZATION';
};

export type CurrentUser = {
  id: number;
  login: string;
  email: string;
  status: UserStatus;
  organization_id?: number | null;
  role_assignments: RoleAssignment[];
  /** Omitted only by older API versions. An empty array means no grants. */
  permissions?: EffectivePermission[];
};

export type LoginRequest = { identifier: string; password: string };
export type LoginResponse = { access_token: string; expires_at: string; user: CurrentUser };

export type OrganizationStatus = 'ACTIVE' | 'INACTIVE';
export type Organization = {
  id: number;
  legal_name: string;
  trade_name?: string | null;
  cnpj: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  status: OrganizationStatus;
  created_at: string;
  updated_at: string;
};
export type CreateOrganizationRequest = {
  legal_name: string;
  trade_name?: string | null;
  cnpj: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  status?: OrganizationStatus;
};

export type User = CurrentUser & { created_at: string; updated_at: string };
export type CreateUserRequest = {
  login: string;
  email: string;
  password: string;
  organization_id?: number;
};

export type Permission = {
  id: number;
  key: string;
  resource: string;
  action: string;
  scope: 'PLATFORM' | 'ORGANIZATION';
  description: string;
};

export type OrgRole = {
  id: number;
  organization_id: number;
  name: string;
  description?: string | null;
  is_active: boolean;
  permissions: Permission[];
  created_at: string;
  updated_at: string;
};

export type CompanyStatus = 'active' | 'inactive' | 'blocked';
export type Company = {
  id: number;
  organization_id: number;
  name: string;
  corporate_name?: string | null;
  document?: string | null;
  status: CompanyStatus;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};
export type CreateCompanyRequest = {
  organization_id: number;
  name: string;
  corporate_name?: string | null;
  document?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ProjectStatus = 'draft' | 'active' | 'paused' | 'inactive' | 'finished' | 'cancelled' | 'archived';
export type ProjectLifecycleAction = 'activate' | 'pause' | 'resume' | 'finish' | 'cancel' | 'archive';
export type ProjectAvailableAction = { action: ProjectLifecycleAction; permission: string };
export type Project = {
  id: number;
  organization_id: number;
  company_id?: number | null;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  start_date?: string | null;
  end_date?: string | null;
  finished_at?: string | null;
  settings?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  created_by_id?: number | null;
  updated_by_id?: number | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  available_actions?: ProjectAvailableAction[];
};
export type CreateProjectRequest = {
  organization_id: number;
  company_id: number;
  name: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  settings?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

export type UpdateProjectRequest = {
  name?: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

export type CompanyUnitStatus = 'active' | 'inactive';
export type CompanyUnit = {
  id: number;
  organization_id: number;
  company_id: number;
  name: string;
  code?: string | null;
  status: CompanyUnitStatus;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

export type ProjectUnit = {
  id: number;
  organization_id: number;
  project_id: number;
  company_unit_id: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  company_unit?: CompanyUnit;
  unit?: CompanyUnit;
  company_unit_name?: string;
  company_unit_code?: string | null;
};

export type ProjectUnitListResponse = {
  items: ProjectUnit[];
};

export type ExportJobType =
  | 'inventory_items_xlsx'
  | 'inventory_accounting_items_xlsx'
  | 'pending_issues_xlsx'
  | 'payments_xlsx'
  | 'expenses_xlsx'
  | 'project_backup_xlsx';
export type ExportJobStatus = 'pending' | 'processing' | 'finished' | 'failed' | 'cancelled' | 'expired';
export type ExportJob = {
  id: number;
  organization_id: number;
  project_id: number;
  type: ExportJobType;
  status: ExportJobStatus;
  file_name?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  checksum?: string | null;
  requested_by_id: number | null;
  retry_of_id?: number | null;
  attempt_count: number;
  requested_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  expires_at?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
};
export type ExportJobDownloadUrlResponse = {
  job: ExportJob;
  download_url: string;
  expires_in_seconds: number;
  requires_authentication: true;
};

export type ProjectSummaryProject = {
  id: number;
  name: string;
  status: ProjectStatus;
  organization_id: number;
  start_date?: string | null;
  end_date?: string | null;
  created_at: string;
};
export type ProjectInventorySummary = {
  total_items: number;
  evaluated_items: number;
  pending_items: number;
  divergent_items: number;
  not_found_items: number;
  duplicated_items: number;
  removed_items: number;
  inactive_items: number;
  progress_percentage: number;
};
export type ProjectImagesSummary = {
  total_images: number;
  uploaded_images: number;
  pending_upload_images: number;
  removed_images: number;
};
export type ProjectAccountingSummary = {
  total_accounting_items: number;
  matched_accounting_items: number;
  divergent_accounting_items: number;
  not_found_accounting_items: number;
  ignored_accounting_items: number;
};
export type ProjectPendingIssuesSummary = {
  total_pending_issues: number;
  open_pending_issues: number;
  in_review_pending_issues: number;
  resolved_pending_issues: number;
  ignored_pending_issues: number;
  cancelled_pending_issues: number;
  critical_pending_issues: number;
  high_pending_issues: number;
  medium_pending_issues: number;
  low_pending_issues: number;
};
export type ProjectFieldAgentsSummary = {
  total_field_agents: number;
  active_field_agents: number;
  inactive_field_agents: number;
  finished_field_agents: number;
};
export type ProjectFinancialSummary = {
  total_payments: number;
  pending_payments: number;
  approved_payments: number;
  paid_payments: number;
  cancelled_payments: number;
  total_payment_amount: string;
  total_expenses: number;
  pending_expenses: number;
  approved_expenses: number;
  paid_expenses: number;
  rejected_expenses: number;
  cancelled_expenses: number;
  total_expense_amount: string;
  financial_total_amount: string;
};
export type ProjectImportsSummary = {
  total_import_sessions: number;
  open_import_sessions: number;
  processing_import_sessions: number;
  finished_import_sessions: number;
  failed_import_sessions: number;
  cancelled_import_sessions: number;
  expired_import_sessions: number;
};
export type ProjectExportsSummary = {
  total_export_jobs: number;
  pending_export_jobs: number;
  processing_export_jobs: number;
  finished_export_jobs: number;
  failed_export_jobs: number;
  cancelled_export_jobs: number;
  expired_export_jobs: number;
};
export type ProjectRecentActivitySummary = {
  last_inventory_item_created_at: string | null;
  last_inventory_item_updated_at: string | null;
  last_import_finished_at: string | null;
  last_export_finished_at: string | null;
  last_pending_issue_created_at: string | null;
  last_payment_updated_at: string | null;
};
export type ProjectSummary = {
  project: ProjectSummaryProject;
  inventory: ProjectInventorySummary;
  images: ProjectImagesSummary;
  accounting: ProjectAccountingSummary;
  pending_issues: ProjectPendingIssuesSummary;
  field_agents: ProjectFieldAgentsSummary;
  financial?: ProjectFinancialSummary | null;
  imports?: ProjectImportsSummary | null;
  exports?: ProjectExportsSummary | null;
  recent_activity?: ProjectRecentActivitySummary | null;
};

export type FieldAgentStatus = 'active' | 'inactive' | 'blocked';
export type FieldAgentListParams = PageParams & {
  status?: FieldAgentStatus;
  search?: string;
};

export type ProjectDashboardPeriod = '7d' | '30d' | 'month' | 'total' | 'custom';
export type ProjectDashboardGrouping = 'day' | 'week' | 'month';
export type ProjectDashboardParams = {
  period?: ProjectDashboardPeriod;
  date_from?: string;
  date_to?: string;
  grouping?: ProjectDashboardGrouping;
  unit?: string;
  state?: string;
  status?: InventoryItemStatus;
};
export type DashboardAvailability = { available: boolean; reason: string | null };
export type ProjectDashboardUnit = {
  unit: string | null;
  total_items: number;
  inventoried_items: number;
  pending_items: number;
  consolidated_items: number | null;
  completion_percentage: number;
};
export type ProjectDashboardAnalytics = {
  project: {
    id: number;
    name: string;
    status: ProjectStatus;
    organization_id: number;
    company_id: number | null;
  };
  summary: {
    total_items: number;
    inventoried_items: number;
    not_inventoried_items: number;
    consolidated_items: number | null;
    pending_consolidation_items: number | null;
    completion_percentage: number;
    consolidation_percentage: number | null;
    total_sectors: number | null;
    total_units: number;
    total_field_agents: number;
    active_days: number;
    average_items_per_active_day: number;
    inventoried_today: number;
    inventoried_last_7_days: number;
    inventoried_last_30_days: number;
    last_activity_at: string | null;
    estimated_completion_date: string | null;
  };
  timeline: Array<{
    period: string;
    inventoried_items: number;
    moving_average: number;
    cumulative_inventoried_items: number;
    cumulative_consolidated_items: number | null;
    total_items_reference: number;
  }>;
  status_distribution: Array<{
    status: InventoryItemStatus;
    total_items: number;
    percentage: number;
  }>;
  units: ProjectDashboardUnit[];
  geography: Array<{
    state: string;
    total_items: number;
    inventoried_items: number;
    pending_items: number;
    consolidated_items: number | null;
    total_units: number;
    total_sectors: number | null;
    completion_percentage: number;
  }>;
  unlocated_items: number;
  data_quality: {
    items_without_unit: number;
    items_without_location: number;
    items_without_description: number;
    items_without_state: number;
  };
  recent_activity: Array<{
    id: number;
    inventory_item_id: number;
    operation: string;
    resulting_status: InventoryItemStatus | null;
    occurred_at: string;
  }>;
  attention_units: ProjectDashboardUnit[];
  sectors: DashboardAvailability;
  consolidation: DashboardAvailability;
  productivity: DashboardAvailability;
  filters: {
    period: ProjectDashboardPeriod;
    date_from: string | null;
    date_to: string | null;
    grouping: ProjectDashboardGrouping;
    unit: string | null;
    state: string | null;
    status: InventoryItemStatus | null;
    available_units: string[];
    available_states: string[];
    available_statuses: InventoryItemStatus[];
  };
  limitations: string[];
  timezone: string;
};
export type FieldAgent = {
  id: number;
  organization_id: number;
  user_id?: number | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  document?: string | null;
  status: FieldAgentStatus;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

export type CreateFieldAgentRequest = {
  user_id?: number | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  document?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type UpdateFieldAgentRequest = Partial<CreateFieldAgentRequest>;

export type ProjectFieldAgentStatus = 'active' | 'inactive' | 'finished';
export type ProjectFieldAgent = {
  id: number;
  organization_id: number;
  project_id: number;
  field_agent_id: number;
  role?: string | null;
  status: ProjectFieldAgentStatus;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

export type AssignProjectFieldAgentRequest = {
  field_agent_id: number;
  role?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
};

export type UpdateProjectFieldAgentRequest = Omit<Partial<AssignProjectFieldAgentRequest>, 'field_agent_id'> & {
  status?: ProjectFieldAgentStatus;
};

export type InventoryItemStatus = 'pending' | 'evaluated' | 'divergent' | 'not_found' | 'duplicated' | 'removed' | 'inactive';
export type InventoryItem = {
  id: number;
  organization_id: number;
  project_id: number;
  external_item_id?: string | null;
  sequence?: string | null;
  old_plate?: string | null;
  new_plate?: string | null;
  unit_text?: string | null;
  address_text?: string | null;
  location_text?: string | null;
  description?: string | null;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  capacity?: string | null;
  year?: number | null;
  notes?: string | null;
  source?: string | null;
  used_value?: string | null;
  new_value?: string | null;
  status: InventoryItemStatus;
  metadata?: Record<string, unknown> | null;
  created_by_id?: number | null;
  updated_by_id?: number | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

export type InventoryItemInput = {
  external_item_id?: string | null;
  sequence?: string | null;
  old_plate?: string | null;
  new_plate?: string | null;
  unit_text?: string | null;
  address_text?: string | null;
  location_text?: string | null;
  description?: string | null;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  capacity?: string | null;
  year?: number | null;
  notes?: string | null;
  source?: string | null;
  used_value?: string | null;
  new_value?: string | null;
  status?: InventoryItemStatus;
  metadata?: Record<string, unknown> | null;
};

export type InventoryItemImageStatus = 'pending_upload' | 'uploaded' | 'failed' | 'removed';
export type InventoryItemImage = {
  id: number;
  organization_id: number;
  inventory_item_id: number;
  storage_provider: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  checksum?: string | null;
  status: InventoryItemImageStatus;
  uploaded_by_id?: number | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

export type CreateInventoryItemImageUploadRequest = {
  original_name: string;
  mime_type: 'image/jpeg' | 'image/jpg' | 'image/png' | 'image/webp';
  size_bytes: number;
  checksum?: string | null;
};

export type ConfirmInventoryItemImageUploadRequest = {
  checksum?: string | null;
  size_bytes?: number;
};

export type InventoryItemImageUploadUrlResponse = {
  image: InventoryItemImage;
  upload_url: string;
  expires_in_seconds: number;
};

export type InventoryItemImageDownloadUrlResponse = {
  image: InventoryItemImage;
  download_url: string;
  expires_in_seconds: number;
};

export type InventoryAccountingItemStatus = 'pending' | 'matched' | 'divergent' | 'not_found' | 'ignored' | 'inactive';
export type AccountingImportBatchStatus = 'pending' | 'processing' | 'finished' | 'failed' | 'cancelled';

export type InventoryAccountingItemInput = {
  plate?: string | null;
  description?: string | null;
  accounting_account_description?: string | null;
  location?: string | null;
  acquisition_date?: string | null;
  acquisition_value?: string | null;
  base_code?: string | null;
  status?: InventoryAccountingItemStatus;
  investor_code?: string | null;
  note_1?: string | null;
  note_2?: string | null;
  new_inventory_plate?: string | null;
  inventory_description?: string | null;
  inventory_location?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type InventoryAccountingItem = InventoryAccountingItemInput & {
  id: number;
  organization_id: number;
  project_id: number;
  status: InventoryAccountingItemStatus;
  imported_by_id?: number | null;
  import_batch_id?: number | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

export type AccountingImportBatch = {
  id: number;
  organization_id: number;
  project_id: number;
  original_file_name: string;
  status: AccountingImportBatchStatus;
  total_rows: number;
  processed_rows: number;
  success_rows: number;
  failed_rows: number;
  error_report_path?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type AccountingImportError = {
  row: number;
  errors: string[];
};

export type InventoryPendingIssueType =
  | 'missing_plate'
  | 'accounting_item_not_found'
  | 'physical_item_without_accounting_match'
  | 'plate_divergence'
  | 'description_divergence'
  | 'location_divergence'
  | 'duplicated_item'
  | 'manual_issue'
  | 'other';
export type InventoryPendingIssueStatus = 'open' | 'in_review' | 'resolved' | 'ignored' | 'cancelled';
export type InventoryPendingIssueSeverity = 'low' | 'medium' | 'high' | 'critical';

export type InventoryPendingIssueInput = {
  inventory_item_id?: number | null;
  accounting_item_id?: number | null;
  type?: InventoryPendingIssueType;
  status?: InventoryPendingIssueStatus;
  severity?: InventoryPendingIssueSeverity;
  title?: string;
  description?: string | null;
  old_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

export type CreateInventoryPendingIssueRequest = Omit<InventoryPendingIssueInput, 'status'> & {
  type: InventoryPendingIssueType;
  title: string;
};

export type ResolveInventoryPendingIssueRequest = {
  resolution_notes?: string | null;
};

export type InventoryPendingIssue = CreateInventoryPendingIssueRequest & {
  id: number;
  organization_id: number;
  project_id: number;
  status: InventoryPendingIssueStatus;
  severity: InventoryPendingIssueSeverity;
  resolution_notes?: string | null;
  resolved_by_id?: number | null;
  resolved_at?: string | null;
  ignored_by_id?: number | null;
  ignored_at?: string | null;
  created_by_id?: number | null;
  updated_by_id?: number | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

export type GenerateInventoryPendingIssuesResponse = {
  created: number;
  skipped: number;
};

export type PaymentStatus = 'pending' | 'approved' | 'paid' | 'cancelled';
export type ExpenseStatus = 'pending' | 'approved' | 'rejected' | 'paid' | 'cancelled';
export type ExpenseAttachmentStatus = 'pending_upload' | 'uploaded' | 'failed' | 'removed';

export type PaymentInput = {
  field_agent_id: number;
  state?: string | null;
  start_date: string;
  end_date: string;
  payment_date?: string | null;
  daily_rate: string;
  additional_amount?: string;
  discount_amount?: string;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type FieldAgentPayment = PaymentInput & {
  id: number;
  organization_id: number;
  project_id: number;
  days: number;
  additional_amount: string;
  daily_total: string;
  discount_amount: string;
  final_amount: string;
  status: PaymentStatus;
  created_at: string;
  updated_at: string;
};

export type PaymentSummary = {
  total_pending: string;
  total_approved: string;
  total_paid: string;
  total_cancelled: string;
  total_count: number;
};

export type MarkAsPaidRequest = {
  payment_date?: string | null;
};

export type ExpenseInput = {
  field_agent_id?: number | null;
  description: string;
  reason?: string | null;
  expense_date: string;
  amount: string;
  metadata?: Record<string, unknown> | null;
};

export type Expense = ExpenseInput & {
  id: number;
  organization_id: number;
  project_id: number;
  status: ExpenseStatus;
  created_at: string;
  updated_at: string;
};

export type RejectExpenseRequest = {
  reason: string;
};

export type ExpenseAttachment = {
  id: number;
  organization_id: number;
  expense_id: number;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  checksum?: string | null;
  status: ExpenseAttachmentStatus;
  created_at: string;
};

export type CreateExpenseAttachmentUploadRequest = {
  original_name: string;
  mime_type: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
  size_bytes: number;
  checksum?: string | null;
};

export type ConfirmExpenseAttachmentUploadRequest = {
  checksum?: string | null;
  size_bytes?: number;
};

export type ExpenseAttachmentUploadUrlResponse = {
  attachment: ExpenseAttachment;
  upload_url: string;
  expires_in_seconds: number;
};

export type ExpenseAttachmentDownloadUrlResponse = {
  attachment: ExpenseAttachment;
  download_url: string;
  expires_in_seconds: number;
};

export type ImportSessionType = 'mobile_sync' | 'inventory_items_import' | 'accounting_items_import' | 'images_import' | 'raw_backup_import' | 'incremental_sync' | 'physical_observations_import';
export type ImportSessionSource = 'mobile_app' | 'web_admin' | 'api_client' | 'system' | 'migration';
export type ImportSessionStatus = 'open' | 'receiving' | 'processing' | 'finished' | 'failed' | 'cancelled' | 'expired';
export type ImportPayloadStatus = 'received' | 'processing' | 'processed' | 'failed' | 'duplicated' | 'ignored';
export type ImportFileType = 'raw_payload' | 'raw_backup' | 'image' | 'other';
export type ImportFileStatus = 'pending_upload' | 'uploaded' | 'processed' | 'failed' | 'removed';

export type ImportSessionInput = {
  type: ImportSessionType;
  source: ImportSessionSource;
  expected_payloads?: number;
  metadata?: Record<string, unknown>;
};

export type ImportSession = {
  id: number;
  organization_id: number;
  project_id: number;
  type: ImportSessionType;
  source: ImportSessionSource;
  status: ImportSessionStatus;
  session_uuid: string;
  expected_payloads?: number | null;
  received_payloads: number;
  processed_payloads: number;
  failed_payloads: number;
  total_items: number;
  total_images: number;
  total_created: number;
  total_updated: number;
  total_deleted: number;
  total_failed: number;
  raw_backup_path?: string | null;
  error_message?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type ImportPayloadInput = {
  payload_number: number;
  idempotency_key: string;
  checksum?: string | null;
  items: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
};

export type ImportPayload = {
  id: number;
  payload_number: number;
  idempotency_key: string;
  checksum?: string | null;
  status: ImportPayloadStatus;
  items_count: number;
  images_count: number;
  created_count: number;
  updated_count: number;
  deleted_count: number;
  failed_count: number;
  raw_payload_path?: string | null;
  error_message?: string | null;
};

export type ImportPayloadError = {
  id: number;
  row_number?: number | null;
  item_reference?: string | null;
  error_code: string;
  error_message: string;
  created_at: string;
};

export type ImportFile = {
  id: number;
  type: ImportFileType;
  storage_provider?: string;
  bucket?: string;
  path?: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  checksum?: string | null;
  status: ImportFileStatus;
};

export type CreateImportFileUploadRequest = {
  type: ImportFileType;
  original_name: string;
  mime_type: string;
  size_bytes: number;
};

export type ConfirmImportFileUploadRequest = {
  checksum?: string | null;
  size_bytes?: number;
};

export type ImportFileUploadUrlResponse = {
  file: ImportFile;
  upload_url: string;
  expires_in_seconds: number;
};

export type ImportFileDownloadUrlResponse = {
  file: ImportFile;
  download_url: string;
  expires_in_seconds: number;
};

export type InventorySessionStatus = 'draft' | 'active' | 'finished' | 'cancelled';
export type InventoryRoundKind = 'initial' | 'reinventory';
export type InventoryRoundStatus = 'active' | 'finished' | 'cancelled';
export type InventoryObservationResult = 'found' | 'not_found' | 'divergent' | 'duplicated';
export type ReconciliationStatus = 'matched' | 'physical_surplus' | 'accounting_surplus' | 'duplicate' | 'plate_divergence';
export type ConsolidationDecision = 'accepted' | 'corrected' | 'rejected';

export type InventorySession = {
  id: number;
  organization_id: number;
  project_id: number;
  name: string;
  status: InventorySessionStatus;
  started_at?: string | null;
  finished_at?: string | null;
  created_by_id: number;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  rounds?: InventoryRound[];
};

export type InventoryRound = {
  id: number;
  session_id: number;
  round_number: number;
  kind: InventoryRoundKind;
  inventory_item_id?: number | null;
  reason?: string | null;
  status: InventoryRoundStatus;
  requested_by_id?: number | null;
  started_at: string;
  finished_at?: string | null;
};

export type InventorySessionStartResponse = {
  session: InventorySession;
  round: InventoryRound;
};

export type InventoryObservation = {
  id: number;
  session_id: number;
  round_id: number;
  inventory_item_id: number;
  field_agent_id: number;
  prior_observation_id?: number | null;
  idempotency_key?: string | null;
  result: InventoryObservationResult;
  observed_plate?: string | null;
  observed_serial_number?: string | null;
  unit_text?: string | null;
  sector_text?: string | null;
  location_text?: string | null;
  notes?: string | null;
  captured_at: string;
  received_at: string;
};

export type CreateInventoryObservationRequest = {
  inventory_item_id: number;
  field_agent_id: number;
  idempotency_key?: string;
  result: InventoryObservationResult;
  observed_plate?: string | null;
  observed_serial_number?: string | null;
  unit_text?: string | null;
  sector_text?: string | null;
  location_text?: string | null;
  notes?: string | null;
  captured_at?: string;
};

export type InventoryReconciliation = {
  id: number;
  session_id: number;
  run_number: number;
  inventory_item_id?: number | null;
  observation_id?: number | null;
  accounting_item_id?: number | null;
  status: ReconciliationStatus;
  physical_plate?: string | null;
  accounting_plate?: string | null;
  evidence?: Record<string, unknown> | null;
  created_by_id: number;
  created_at: string;
};

export type AssetValuation = {
  id: number;
  inventory_item_id: number;
  source: string;
  new_value?: string | null;
  used_value?: string | null;
  valuation_date: string;
  notes?: string | null;
  responsible_by_id: number;
  created_at: string;
};

export type PlateHistoryEntry = {
  id: number;
  inventory_item_id: number;
  source: 'field' | 'physical_base' | 'accounting_base' | 'manual';
  observation_id?: number | null;
  previous_plate?: string | null;
  observed_plate?: string | null;
  recorded_by_id?: number | null;
  created_at: string;
};

export type ExpenseAccountabilityStatus = 'open' | 'closed' | 'cancelled';
export type ExpenseAccountability = {
  id: number;
  organization_id: number;
  project_id: number;
  field_agent_id: number;
  period_start: string;
  period_end: string;
  status: ExpenseAccountabilityStatus;
  total_amount: string;
  notes?: string | null;
  responsible_by_id: number;
  closed_by_id?: number | null;
  closed_at?: string | null;
  expense_ids: number[];
  created_at: string;
  updated_at: string;
};

export type ExpenseInstallment = {
  id: number;
  expense_id: number;
  installment_number: number;
  installment_count: number;
  due_date: string;
  amount: string;
  origin?: string | null;
  created_at: string;
};
