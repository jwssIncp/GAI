import { expect, test } from '@playwright/test';

const user = {
  id: 1,
  login: 'platform.admin',
  email: 'admin@gai.local',
  status: 'ACTIVE',
  organization_id: null,
  role_assignments: [
    { assignment_id: 1, role_id: 1, role_key: 'PLATFORM_ADMIN', role_name: 'Platform Administrator', role_type: 'SYSTEM', organization_id: null, assigned_at: '2026-01-01T00:00:00.000Z' },
  ],
};

const limitedUser = {
  ...user,
  login: 'org.user',
  organization_id: 1,
  role_assignments: [
    { assignment_id: 2, role_id: 3, role_key: 'ORG_USER', role_name: 'Organization User', role_type: 'SYSTEM', organization_id: 1, assigned_at: '2026-01-01T00:00:00.000Z' },
  ],
};

async function mockApi(page: any, sessionUser: any = user) {
  await page.route('**/api/v1/auth/login**', async (route: any) => route.fulfill({ json: { access_token: 'token-123', expires_at: '2099-01-01T00:00:00.000Z', user: sessionUser } }));
  await page.route('**/api/v1/auth/me**', async (route: any) => route.fulfill({ json: sessionUser }));
  await page.route('**/api/v1/auth/logout**', async (route: any) => route.fulfill({ status: 204 }));
  await page.route('**/api/v1/organizations**', async (route: any) => route.fulfill({ json: { items: [{ id: '3fa85f64-5717-4562-b3fc-2c963f66afa6', legal_name: 'Empresa Exemplo Ltda', trade_name: 'Exemplo', cnpj: '11222333000181', contact_email: 'contato@exemplo.com.br', contact_phone: null, status: 'ACTIVE', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' }], page: 1, page_size: 20, total_items: 1, total_pages: 1 } }));
  await page.route('**/api/v1/users**', async (route: any) => route.fulfill({ json: { data: [], meta: { page: 1, page_size: 20, total: 0, total_pages: 0 } } }));
  await page.route('**/api/v1/companies**', async (route: any) => route.fulfill({ json: { items: [], page: 1, page_size: 20, total_items: 0, total_pages: 0 } }));
  await page.route('**/api/v1/projects**', async (route: any) => route.fulfill({ json: { items: [], page: 1, page_size: 20, total_items: 0, total_pages: 0 } }));
  await page.route('**/api/v1/projects/10', async (route: any) => route.fulfill({ json: project }));
  await page.route('**/api/v1/projects/10/summary**', async (route: any) => route.fulfill({ json: projectSummary }));
  await page.route('**/api/v1/projects/10/dashboard**', async (route: any) => route.fulfill({ json: projectSummary }));
  await page.route('**/api/v1/field-agents**', async (route: any) => route.fulfill({ json: { items: [fieldAgent], page: 1, page_size: 20, total_items: 1, total_pages: 1 } }));
  await page.route('**/api/v1/field-agents/7**', async (route: any) => route.fulfill({ json: fieldAgent }));
  await page.route('**/api/v1/projects/10/inventory-items**', async (route: any) => route.fulfill({ json: { items: [inventoryItem], page: 1, page_size: 20, total_items: 1, total_pages: 1 } }));
  await page.route('**/api/v1/projects/10/inventory-items/11**', async (route: any) => route.fulfill({ json: inventoryItem }));
  await page.route('**/api/v1/projects/10/inventory-items/11/images**', async (route: any) =>
    route.fulfill({ json: { items: [inventoryItemImage], page: 1, page_size: 12, total_items: 1, total_pages: 1 } }),
  );
  await page.route('**/api/v1/projects/10/inventory-items/11/images/upload-url', async (route: any) =>
    route.fulfill({ json: { image: { ...inventoryItemImage, id: 32, status: 'pending_upload', original_name: 'nova.webp' }, upload_url: 'https://upload.example/private-put', expires_in_seconds: 300 } }),
  );
  await page.route('**/api/v1/projects/10/inventory-items/11/images/32/confirm-upload', async (route: any) =>
    route.fulfill({ json: { ...inventoryItemImage, id: 32, original_name: 'nova.webp' } }),
  );
  await page.route('**/api/v1/projects/10/inventory-items/11/images/31/download-url', async (route: any) =>
    route.fulfill({ json: { image: inventoryItemImage, download_url: 'https://signed.example/preview.webp', expires_in_seconds: 300 } }),
  );
  await page.route('**/api/v1/projects/10/inventory-items/11/images/31/remove', async (route: any) =>
    route.fulfill({ json: { ...inventoryItemImage, status: 'removed' } }),
  );
  await page.route('**/api/v1/projects/10/inventory-accounting-items**', async (route: any) =>
    route.fulfill({ json: { items: [accountingItem], page: 1, page_size: 20, total_items: 1, total_pages: 1 } }),
  );
  await page.route('**/api/v1/projects/10/inventory-accounting-items/21', async (route: any) => route.fulfill({ json: accountingItem }));
  await page.route('**/api/v1/projects/10/accounting-imports**', async (route: any) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 201, json: accountingImportBatch });
      return;
    }
    await route.fulfill({ json: { items: [accountingImportBatch], page: 1, page_size: 5, total_items: 1, total_pages: 1 } });
  });
  await page.route('**/api/v1/projects/10/accounting-imports/70/errors', async (route: any) =>
    route.fulfill({ json: { items: [{ row: 3, errors: ['Placa obrigatoria'] }] } }),
  );
  await page.route('**/api/v1/projects/10/import-sessions**', async (route: any) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 201, json: importSession });
      return;
    }
    await route.fulfill({ json: { items: [importSession], page: 1, page_size: 20, total_items: 1, total_pages: 1 } });
  });
  await page.route('**/api/v1/projects/10/import-sessions/50/finish', async (route: any) => route.fulfill({ json: { ...importSession, status: 'processing' } }));
  await page.route('**/api/v1/projects/10/import-sessions/50/cancel', async (route: any) => route.fulfill({ json: { ...importSession, status: 'cancelled' } }));
  await page.route('**/api/v1/projects/10/import-sessions/50/retry', async (route: any) => route.fulfill({ json: { ...importSession, status: 'processing' } }));
  await page.route('**/api/v1/projects/10/import-sessions/50/payloads', async (route: any) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 201, json: importPayload });
      return;
    }
    await route.fulfill({ json: { items: [importPayload], page: 1, page_size: 10, total_items: 1, total_pages: 1 } });
  });
  await page.route('**/api/v1/projects/10/import-sessions/50/payloads/70/reprocess', async (route: any) =>
    route.fulfill({ json: { ...importPayload, status: 'processing' } }),
  );
  await page.route('**/api/v1/projects/10/import-sessions/50/errors', async (route: any) =>
    route.fulfill({ json: { items: [importError], page: 1, page_size: 10, total_items: 1, total_pages: 1 } }),
  );
  await page.route('**/api/v1/projects/10/import-sessions/50/files/upload-url', async (route: any) =>
    route.fulfill({ status: 201, json: { file: { ...importFile, id: 82, original_name: 'novo.json', status: 'pending_upload' }, upload_url: 'https://upload.example/import-file', expires_in_seconds: 300 } }),
  );
  await page.route('**/api/v1/projects/10/import-sessions/50/files/82/confirm-upload', async (route: any) =>
    route.fulfill({ json: { ...importFile, id: 82, original_name: 'novo.json' } }),
  );
  await page.route('**/api/v1/projects/10/import-sessions/50/files/81/download-url', async (route: any) =>
    route.fulfill({ json: { file: importFile, download_url: 'https://signed.example/import-raw.json', expires_in_seconds: 300 } }),
  );
  await page.route('**/api/v1/projects/10/import-sessions/50/files', async (route: any) => route.fulfill({ json: [importFile] }));
  await page.route('**/api/v1/projects/10/import-sessions/50', async (route: any) => route.fulfill({ json: importSession }));
  await page.route('**/api/v1/projects/10/import-sessions/50/payloads', async (route: any) =>
    route.fulfill({ json: { items: [importPayload], page: 1, page_size: 10, total_items: 1, total_pages: 1 } }),
  );
  await page.route('**/api/v1/projects/10/import-sessions/50/errors', async (route: any) =>
    route.fulfill({ json: { items: [importError], page: 1, page_size: 10, total_items: 1, total_pages: 1 } }),
  );
  await page.route('**/api/v1/projects/10/import-sessions/50/files', async (route: any) => route.fulfill({ json: [importFile] }));
  await page.route('**/api/v1/projects/10/pending-issues**', async (route: any) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 201, json: pendingIssue });
      return;
    }
    await route.fulfill({ json: { items: [pendingIssue], page: 1, page_size: 20, total_items: 1, total_pages: 1 } });
  });
  await page.route('**/api/v1/projects/10/pending-issues/generate', async (route: any) =>
    route.fulfill({ status: 201, json: { created: 3, skipped: 1 } }),
  );
  await page.route('**/api/v1/projects/10/pending-issues/41/resolve', async (route: any) =>
    route.fulfill({ json: { ...pendingIssue, status: 'resolved', resolution_notes: 'Conferido' } }),
  );
  await page.route('**/api/v1/projects/10/pending-issues/41/ignore', async (route: any) =>
    route.fulfill({ json: { ...pendingIssue, status: 'ignored' } }),
  );
  await page.route('**/api/v1/projects/10/pending-issues/41/cancel', async (route: any) =>
    route.fulfill({ json: { ...pendingIssue, status: 'cancelled' } }),
  );
  await page.route('**/api/v1/projects/10/pending-issues/41', async (route: any) => route.fulfill({ json: pendingIssue }));
  await page.route('**/api/v1/projects/10/payments**', async (route: any) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 201, json: payment });
      return;
    }
    await route.fulfill({ json: { items: [payment], page: 1, page_size: 20, total_items: 1, total_pages: 1 } });
  });
  await page.route('**/api/v1/projects/10/payments/summary', async (route: any) =>
    route.fulfill({ json: { total_pending: '320.00', total_approved: '0.00', total_paid: '0.00', total_cancelled: '0.00', total_count: 1 } }),
  );
  await page.route('**/api/v1/projects/10/payments/10/approve', async (route: any) => route.fulfill({ json: { ...payment, status: 'approved' } }));
  await page.route('**/api/v1/projects/10/payments/10/mark-as-paid', async (route: any) => route.fulfill({ json: { ...payment, status: 'paid' } }));
  await page.route('**/api/v1/projects/10/payments/10/cancel', async (route: any) => route.fulfill({ json: { ...payment, status: 'cancelled' } }));
  await page.route('**/api/v1/projects/10/payments/10', async (route: any) => route.fulfill({ json: payment }));
  await page.route('**/api/v1/projects/10/expenses**', async (route: any) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 201, json: expense });
      return;
    }
    await route.fulfill({ json: { items: [expense], page: 1, page_size: 20, total_items: 1, total_pages: 1 } });
  });
  await page.route('**/api/v1/projects/10/expenses/15/approve', async (route: any) => route.fulfill({ json: { ...expense, status: 'approved' } }));
  await page.route('**/api/v1/projects/10/expenses/15/reject', async (route: any) => route.fulfill({ json: { ...expense, status: 'rejected' } }));
  await page.route('**/api/v1/projects/10/expenses/15/mark-as-paid', async (route: any) => route.fulfill({ json: { ...expense, status: 'paid' } }));
  await page.route('**/api/v1/projects/10/expenses/15/cancel', async (route: any) => route.fulfill({ json: { ...expense, status: 'cancelled' } }));
  await page.route('**/api/v1/projects/10/expenses/15/attachments/upload-url', async (route: any) =>
    route.fulfill({ status: 201, json: { attachment: { ...expenseAttachment, id: 81, original_name: 'novo.pdf', status: 'pending_upload' }, upload_url: 'https://upload.example/expense-proof', expires_in_seconds: 300 } }),
  );
  await page.route('**/api/v1/projects/10/expenses/15/attachments/81/confirm-upload', async (route: any) =>
    route.fulfill({ json: { ...expenseAttachment, id: 81, original_name: 'novo.pdf' } }),
  );
  await page.route('**/api/v1/projects/10/expenses/15/attachments/80/download-url', async (route: any) =>
    route.fulfill({ json: { attachment: expenseAttachment, download_url: 'https://signed.example/recibo.pdf', expires_in_seconds: 300 } }),
  );
  await page.route('**/api/v1/projects/10/expenses/15/attachments/80/remove', async (route: any) =>
    route.fulfill({ json: { ...expenseAttachment, status: 'removed' } }),
  );
  await page.route('**/api/v1/projects/10/expenses/15/attachments', async (route: any) => route.fulfill({ json: [expenseAttachment] }));
  await page.route('**/api/v1/projects/10/expenses/15', async (route: any) => route.fulfill({ json: expense }));
  await page.route('https://upload.example/private-put', async (route: any) => route.fulfill({ status: 200 }));
  await page.route('https://upload.example/import-file', async (route: any) => route.fulfill({ status: 200 }));
  await page.route('https://upload.example/expense-proof', async (route: any) => route.fulfill({ status: 200 }));
  await page.route('https://signed.example/preview.webp', async (route: any) =>
    route.fulfill({ contentType: 'image/webp', body: Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64') }),
  );
}

const fieldAgent = {
  id: 7,
  organization_id: 1,
  user_id: null,
  name: 'Ana Inventariante',
  email: 'ana@gai.local',
  phone: '11999998888',
  document: '12345678900',
  status: 'active',
  metadata: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const inventoryItem = {
  id: 11,
  organization_id: 1,
  project_id: 10,
  external_item_id: 'EXT-1',
  sequence: '001',
  old_plate: 'OLD-1',
  new_plate: 'NEW-1',
  unit_text: 'Unidade A',
  address_text: 'Rua 1',
  location_text: 'Sala 10',
  description: 'Notebook Dell',
  brand: 'Dell',
  model: 'Latitude',
  serial_number: 'SN123',
  capacity: '16GB',
  year: 2024,
  notes: 'Em uso',
  source: 'manual',
  used_value: '1200.00',
  new_value: '3500.00',
  status: 'pending',
  metadata: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
};

const inventoryItemImage = {
  id: 31,
  organization_id: 1,
  inventory_item_id: 11,
  storage_provider: 's3',
  original_name: 'frente.webp',
  mime_type: 'image/webp',
  size_bytes: 2048,
  checksum: null,
  status: 'uploaded',
  uploaded_by_id: 1,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
};

const accountingItem = {
  id: 21,
  organization_id: 1,
  project_id: 10,
  plate: 'PAT-001',
  description: 'Notebook contabil',
  accounting_account_description: 'Equipamentos de informatica',
  location: 'Sala 20',
  acquisition_date: '2025-01-10',
  acquisition_value: '2500.50',
  base_code: 'BASE-1',
  status: 'pending',
  investor_code: 'INV-9',
  note_1: 'Obs A',
  note_2: null,
  new_inventory_plate: 'NEW-001',
  inventory_description: 'Notebook inventario',
  inventory_location: 'Sala 21',
  metadata: null,
  imported_by_id: 1,
  import_batch_id: 70,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
  deleted_at: null,
};

const accountingImportBatch = {
  id: 70,
  organization_id: 1,
  project_id: 10,
  original_file_name: 'base.xlsx',
  status: 'finished',
  total_rows: 10,
  processed_rows: 10,
  success_rows: 9,
  failed_rows: 1,
  error_report_path: null,
  started_at: '2026-01-01T00:00:00.000Z',
  finished_at: '2026-01-01T00:05:00.000Z',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:05:00.000Z',
};

const importSession = {
  id: 50,
  organization_id: 1,
  project_id: 10,
  type: 'mobile_sync',
  source: 'mobile_app',
  status: 'open',
  session_uuid: 'uuid-50',
  expected_payloads: 2,
  received_payloads: 1,
  processed_payloads: 0,
  failed_payloads: 1,
  total_items: 4,
  total_images: 2,
  total_created: 1,
  total_updated: 2,
  total_deleted: 0,
  total_failed: 1,
  raw_backup_path: 'private/raw.zip',
  error_message: null,
  metadata: { device: 'mobile' },
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:05:00.000Z',
};

const importPayload = {
  id: 70,
  payload_number: 1,
  idempotency_key: 'idem-1',
  checksum: 'abc',
  status: 'failed',
  items_count: 4,
  images_count: 2,
  created_count: 1,
  updated_count: 2,
  deleted_count: 0,
  failed_count: 1,
  raw_payload_path: 'raw/payload.json',
  error_message: 'Erro de teste',
};

const importError = {
  id: 90,
  row_number: 3,
  item_reference: 'PAT-1',
  error_code: 'INVALID_ITEM',
  error_message: 'Item invalido',
  created_at: '2026-01-01T00:06:00.000Z',
};

const importFile = {
  id: 81,
  type: 'raw_payload',
  storage_provider: 's3',
  bucket: 'private',
  path: 'imports/raw.json',
  original_name: 'raw.json',
  mime_type: 'application/json',
  size_bytes: 1200,
  checksum: 'xyz',
  status: 'uploaded',
};

const pendingIssue = {
  id: 41,
  organization_id: 1,
  project_id: 10,
  inventory_item_id: 11,
  accounting_item_id: 21,
  type: 'plate_divergence',
  status: 'open',
  severity: 'high',
  title: 'Placa divergente',
  description: 'Placa fisica difere da base contabil',
  old_value: { plate: 'OLD-1' },
  new_value: { plate: 'NEW-1' },
  resolution_notes: null,
  resolved_by_id: null,
  resolved_at: null,
  ignored_by_id: null,
  ignored_at: null,
  created_by_id: 1,
  updated_by_id: 1,
  metadata: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
  deleted_at: null,
};

const project = {
  id: 10,
  organization_id: 1,
  company_id: 3,
  name: 'Projeto Alpha',
  description: 'Inventario da filial SP',
  status: 'active',
  start_date: '2026-01-01',
  end_date: null,
  finished_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
};

const projectSummary = {
  project: {
    id: 10,
    name: 'Projeto Alpha',
    status: 'active',
    organization_id: 1,
    start_date: '2026-01-01',
    end_date: null,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  inventory: { total_items: 1, evaluated_items: 0, pending_items: 1, divergent_items: 0, not_found_items: 0, duplicated_items: 0, removed_items: 0, inactive_items: 0, progress_percentage: 0 },
  images: { total_images: 1, uploaded_images: 1, pending_upload_images: 0, removed_images: 0 },
  accounting: { total_accounting_items: 1, matched_accounting_items: 0, divergent_accounting_items: 0, not_found_accounting_items: 0, ignored_accounting_items: 0 },
  pending_issues: { total_pending_issues: 1, open_pending_issues: 1, in_review_pending_issues: 0, resolved_pending_issues: 0, ignored_pending_issues: 0, cancelled_pending_issues: 0, critical_pending_issues: 0, high_pending_issues: 1, medium_pending_issues: 0, low_pending_issues: 0 },
  field_agents: { total_field_agents: 1, active_field_agents: 1, inactive_field_agents: 0, finished_field_agents: 0 },
  financial: null,
  imports: null,
  exports: { total_export_jobs: 0, pending_export_jobs: 0, processing_export_jobs: 0, finished_export_jobs: 0, failed_export_jobs: 0, cancelled_export_jobs: 0, expired_export_jobs: 0 },
  recent_activity: { last_inventory_item_created_at: null, last_inventory_item_updated_at: null, last_import_finished_at: null, last_export_finished_at: null, last_pending_issue_created_at: null, last_payment_updated_at: null },
};

const payment = {
  id: 10,
  organization_id: 1,
  project_id: 10,
  field_agent_id: 7,
  state: 'SP',
  start_date: '2026-01-01',
  end_date: '2026-01-03',
  payment_date: null,
  days: 3,
  daily_rate: '100.00',
  additional_amount: '20.00',
  daily_total: '300.00',
  discount_amount: '0.00',
  final_amount: '320.00',
  status: 'pending',
  notes: 'Diarias janeiro',
  metadata: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const expense = {
  id: 15,
  organization_id: 1,
  project_id: 10,
  field_agent_id: 7,
  description: 'Almoco em campo',
  reason: 'Equipe em inventario',
  expense_date: '2026-01-02',
  amount: '45.90',
  status: 'pending',
  metadata: null,
  created_at: '2026-01-02T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
};

const expenseAttachment = {
  id: 80,
  organization_id: 1,
  expense_id: 15,
  original_name: 'recibo.pdf',
  mime_type: 'application/pdf',
  size_bytes: 2048,
  checksum: null,
  status: 'uploaded',
  created_at: '2026-01-02T00:00:00.000Z',
};

async function authenticate(page: any) {
  await page.addInitScript((sessionUser) => {
    window.sessionStorage.setItem(
      'gai.session.v1',
      JSON.stringify({ accessToken: 'token-123', expiresAt: '2099-01-01T00:00:00.000Z', user: sessionUser }),
    );
  }, user);
}

async function authenticateAs(page: any, sessionUser: any) {
  await page.addInitScript((value) => {
    window.sessionStorage.setItem(
      'gai.session.v1',
      JSON.stringify({ accessToken: 'token-123', expiresAt: '2099-01-01T00:00:00.000Z', user: value }),
    );
  }, sessionUser);
}

test('login', async ({ page }) => {
  await mockApi(page);
  let loginCalled = false;
  await page.route('**/api/v1/auth/login**', async (route: any) => {
    loginCalled = true;
    await route.fulfill({ json: { access_token: 'token-123', expires_at: '2099-01-01T00:00:00.000Z', user } });
  });
  await page.goto('/login');
  await page.getByLabel('Login ou email').fill('platform.admin');
  await page.getByLabel('Senha').fill('Admin@123456');
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForURL('**/app/dashboard');
  expect(loginCalled).toBeTruthy();
});

test('logout', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.getByRole('button', { name: /platform.admin/i }).click();
  await page.getByText('Sair').click();
  await expect(page.getByRole('heading', { name: 'Entrar no GAI' })).toBeVisible();
});

test('rota protegida redireciona para login', async ({ page }) => {
  await page.goto('/app/dashboard');
  await expect(page.getByRole('heading', { name: 'Entrar no GAI' })).toBeVisible();
});

test('acesso negado', async ({ page }) => {
  await page.goto('/access-denied');
  await expect(page.getByText('Acesso negado')).toBeVisible();
});

test('listagem paginada', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/organizations');
  await expect(page.getByText('Empresa Exemplo Ltda')).toBeVisible();
  await expect(page.getByText('Pagina 1 de 1')).toBeVisible();
});

test('acessa tela de inventariantes autenticado', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/field-agents');
  await expect(page.getByRole('heading', { name: 'Inventariantes' })).toBeVisible();
  await expect(page.getByText('Ana Inventariante')).toBeVisible();
});

test('bloqueia inventariantes sem permissao', async ({ page }) => {
  await mockApi(page, limitedUser);
  await authenticateAs(page, limitedUser);
  await page.goto('/app/field-agents');
  await expect(page.getByText('Acesso negado')).toBeVisible();
});

test('abre formulario e valida campos obrigatorios de inventariante', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/field-agents');
  await page.getByRole('button', { name: /novo inventariante/i }).click();
  await page.getByRole('button', { name: /salvar inventariante/i }).click();
  await expect(page.getByText('Informe a organization')).toBeVisible();
  await expect(page.getByText('Nome deve ter pelo menos 2 caracteres')).toBeVisible();
});

test('abre detalhe de inventariante', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/field-agents');
  await page.getByLabel('Visualizar inventariante').click();
  await expect(page.getByText('Detalhes do inventariante')).toBeVisible();
  await expect(page.getByText('Inventariante #7')).toBeVisible();
});

test('acessa itens a partir de um projeto autenticado', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/inventory-items');
  await expect(page.getByRole('heading', { name: 'Itens inventariados' })).toBeVisible();
  await expect(page.getByText('Notebook Dell')).toBeVisible();
});

test('bloqueia itens sem permissao', async ({ page }) => {
  await mockApi(page, limitedUser);
  await authenticateAs(page, limitedUser);
  await page.goto('/app/projects/10/inventory-items');
  await expect(page.getByText('Acesso negado')).toBeVisible();
});

test('abre formulario e valida campos obrigatorios de item', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/inventory-items');
  await page.getByRole('button', { name: /novo item/i }).click();
  await page.getByRole('button', { name: /salvar item/i }).click();
  await expect(page.getByText('Informe a descricao do item')).toBeVisible();
});

test('abre detalhe de item', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/inventory-items');
  await page.getByLabel('Visualizar item').click();
  await expect(page.getByText('Item #11 - Projeto #10')).toBeVisible();
  await expect(page.getByLabel('Detalhes do item').getByText('Sala 10')).toBeVisible();
  await expect(page.getByText('frente.webp')).toBeVisible();
});

test('visualiza imagem de item por download-url temporaria', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/inventory-items');
  await page.getByLabel('Visualizar item').click();
  await page.getByRole('button', { name: /visualizar/i }).click();
  await expect(page.getByRole('img', { name: 'frente.webp' })).toHaveAttribute('src', 'https://signed.example/preview.webp');
});

test('envia imagem de item com upload-url e confirmacao', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/inventory-items');
  await page.getByLabel('Visualizar item').click();
  await page.getByLabel('Adicionar imagem').setInputFiles({ name: 'nova.webp', mimeType: 'image/webp', buffer: Buffer.from('fake-image') });
  await expect(page.getByText('Imagem enviada com sucesso.')).toBeVisible();
});

test('remove imagem de item com confirmacao', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/inventory-items');
  await page.getByLabel('Visualizar item').click();
  await page.getByLabel('Remover frente.webp').click();
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByText('Remover imagem')).not.toBeVisible();
});

test('filtra itens por status e busca', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/inventory-items');
  await page.getByLabel('Filtrar por status').selectOption('pending');
  await page.getByPlaceholder('Buscar item').fill('Notebook');
  await expect(page.getByText('Notebook Dell')).toBeVisible();
});

test('acessa base contabil a partir de um projeto autenticado', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/accounting-items');
  await expect(page.getByRole('heading', { name: 'Base contabil' })).toBeVisible();
  await expect(page.getByText('Notebook contabil')).toBeVisible();
  await expect(page.getByText('base.xlsx')).toBeVisible();
});

test('bloqueia base contabil sem permissao', async ({ page }) => {
  await mockApi(page, limitedUser);
  await authenticateAs(page, limitedUser);
  await page.goto('/app/projects/10/accounting-items');
  await expect(page.getByText('Acesso negado')).toBeVisible();
});

test('abre modal e valida arquivo invalido da base contabil', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/accounting-items');
  await page.getByRole('button', { name: /importar xlsx/i }).click();
  await page.getByLabel('Selecionar XLSX contabil').setInputFiles({ name: 'base.csv', mimeType: 'text/csv', buffer: Buffer.from('csv') });
  await expect(page.getByText('Envie um arquivo .xlsx valido.')).toBeVisible();
});

test('filtra base contabil por status e placa', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/accounting-items');
  await page.getByLabel('Filtrar base contabil por status').selectOption('pending');
  await page.getByPlaceholder('Placa').fill('PAT');
  await expect(page.getByText('Notebook contabil')).toBeVisible();
});

test('abre detalhe de item contabil', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/accounting-items');
  await page.getByLabel('Visualizar item contabil').click();
  await expect(page.getByText('Item contabil #21 - Projeto #10')).toBeVisible();
  await expect(page.getByLabel('Detalhes do item contabil').getByText('Sala 20')).toBeVisible();
});

test('acessa pendencias a partir de um projeto autenticado', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/pending-issues');
  await expect(page.getByRole('heading', { name: 'Pendencias' })).toBeVisible();
  await expect(page.getByText('Placa divergente')).toBeVisible();
});

test('bloqueia pendencias sem permissao', async ({ page }) => {
  await mockApi(page, limitedUser);
  await authenticateAs(page, limitedUser);
  await page.goto('/app/projects/10/pending-issues');
  await expect(page.getByText('Acesso negado')).toBeVisible();
});

test('abre nova pendencia e valida obrigatorios', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/pending-issues');
  await page.getByRole('button', { name: /nova pendencia/i }).click();
  await page.getByLabel('Titulo').fill('');
  await page.getByRole('button', { name: /salvar pendencia/i }).click();
  await expect(page.getByText('Informe o titulo')).toBeVisible();
});

test('filtra pendencias por status', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/pending-issues');
  await page.getByLabel('Filtrar pendencia por status').selectOption('open');
  await expect(page.getByText('Placa divergente')).toBeVisible();
});

test('abre detalhe da pendencia', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/pending-issues');
  await page.getByLabel('Visualizar pendencia').click();
  await expect(page.getByText(/Pendencia #41/)).toBeVisible();
  await expect(page.getByText('Item inventariado #11')).toBeVisible();
});

test('resolve pendencia com observacao', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/pending-issues');
  await page.getByLabel('Resolver pendencia').click();
  await page.getByLabel('Observacoes da resolucao').fill('Conferido');
  await page.getByRole('button', { name: /resolver pendencia/i }).click();
  await expect(page.getByRole('heading', { name: 'Resolver pendencia' })).not.toBeVisible();
});

test('ignora pendencia', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/pending-issues');
  await page.getByLabel('Ignorar pendencia').click();
  await page.getByLabel('Motivo ou observacao').fill('Nao aplicavel');
  await page.getByRole('button', { name: /ignorar pendencia/i }).click();
  await expect(page.getByRole('heading', { name: 'Ignorar pendencia' })).not.toBeVisible();
});

test('cancela pendencia com confirmacao', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/pending-issues');
  await page.getByLabel('Cancelar pendencia').click();
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByText('Cancelar pendencia')).not.toBeVisible();
});

test('aciona geracao automatica de pendencias', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/pending-issues');
  await page.getByRole('button', { name: /gerar pendencias/i }).click();
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByText('Geracao concluida: 3 criada(s), 1 ignorada(s).')).toBeVisible();
});

test('acessa financeiro do projeto com listagem paginada', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/finance');
  await expect(page.getByRole('heading', { name: 'Financeiro do projeto' })).toBeVisible();
  await expect(page.getByText('Pagamento #10')).toBeVisible();
  await expect(page.getByText('Pagina 1 de 1')).toBeVisible();
});

test('bloqueia financeiro sem permissao', async ({ page }) => {
  await mockApi(page, limitedUser);
  await authenticateAs(page, limitedUser);
  await page.goto('/app/projects/10/finance');
  await expect(page.getByText('Acesso negado')).toBeVisible();
});

test('valida novo pagamento no financeiro', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/finance');
  await page.getByRole('button', { name: /novo pagamento/i }).click();
  await page.getByRole('button', { name: /criar pagamento/i }).click();
  await expect(page.getByText('Selecione o inventariante')).toBeVisible();
});

test('filtra pagamentos no financeiro', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/finance');
  await page.getByLabel('Filtrar pagamento por status').selectOption('pending');
  await page.getByPlaceholder('UF/Estado').fill('SP');
  await expect(page.getByText('Pagamento #10')).toBeVisible();
});

test('envia comprovante de despesa no financeiro', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/finance');
  await page.getByRole('button', { name: 'Despesas' }).click();
  await expect(page.getByText('Almoco em campo')).toBeVisible();
  await page.getByLabel('Comprovantes da despesa').click();
  await expect(page.getByText('recibo.pdf')).toBeVisible();
  await page.getByLabel('Enviar comprovante').setInputFiles({ name: 'novo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('fake-pdf') });
  await expect(page.getByText('Comprovante enviado com sucesso.')).toBeVisible();
});

test('acessa exportacoes a partir de um projeto autenticado', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/export-jobs');
  await expect(page.getByRole('heading', { name: 'Exportacoes' })).toBeVisible();
  await expect(page.getByText('Export jobs ainda nao disponiveis')).toBeVisible();
  await expect(page.getByRole('button', { name: /nova exportacao/i })).toBeDisabled();
});

test('acessa workspace consolidado do projeto', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/summary');
  await expect(page.getByRole('heading', { name: 'Projeto Alpha' })).toBeVisible();
  await expect(page.getByText('Inventario da filial SP')).toBeVisible();
  await expect(page.getByText('Total de itens')).toBeVisible();
  await expect(page.getByText('Alertas operacionais')).toBeVisible();
});

test('navega entre abas do workspace do projeto', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/summary');
  await page.getByRole('link', { name: 'Itens', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Itens inventariados' })).toBeVisible();
});

test('abre atalho rapido de novo item no workspace', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/summary');
  await page.getByRole('button', { name: /novo item/i }).click();
  await expect(page.getByRole('heading', { name: 'Itens inventariados' })).toBeVisible();
});

test('bloqueia workspace sem permissao de projeto', async ({ page }) => {
  await mockApi(page, limitedUser);
  await authenticateAs(page, limitedUser);
  await page.goto('/app/projects/10/summary');
  await expect(page.getByText('Acesso negado')).toBeVisible();
});

test('bloqueia exportacoes sem permissao de projeto', async ({ page }) => {
  await mockApi(page, limitedUser);
  await authenticateAs(page, limitedUser);
  await page.goto('/app/projects/10/export-jobs');
  await expect(page.getByText('Acesso negado')).toBeVisible();
});

test('abre exportacoes pelo resumo do projeto', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/summary');
  await page.getByRole('link', { name: 'Exportacoes' }).first().click();
  await expect(page.getByRole('heading', { name: 'Exportacoes' })).toBeVisible();
});

test('acessa importacoes a partir de um projeto autenticado', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/import-sessions');
  await expect(page.getByRole('heading', { name: 'Importacoes' })).toBeVisible();
  await expect(page.getByText('uuid-50')).toBeVisible();
});

test('bloqueia importacoes sem permissao', async ({ page }) => {
  await mockApi(page, limitedUser);
  await authenticateAs(page, limitedUser);
  await page.goto('/app/projects/10/import-sessions');
  await expect(page.getByText('Acesso negado')).toBeVisible();
});

test('abre nova importacao e valida tipo obrigatorio', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/import-sessions');
  await page.getByRole('button', { name: /nova importacao/i }).click();
  await page.getByRole('button', { name: /criar importacao/i }).click();
  await expect(page.getByText('Selecione o tipo')).toBeVisible();
});

test('preenche formulario de criacao de importacao', async ({ page }) => {
  await mockApi(page);
  await page.route('**/api/v1/projects/10/import-sessions', async (route: any) => {
    if (route.request().method() === 'POST') await route.fulfill({ status: 201, json: importSession });
    else await route.fallback();
  });
  await authenticate(page);
  await page.goto('/app/projects/10/import-sessions');
  await page.getByRole('button', { name: /nova importacao/i }).click();
  await page.locator('select[name="type"]').selectOption('mobile_sync');
  await page.locator('select[name="source"]').selectOption('mobile_app');
  await page.locator('input[name="expected_payloads"]').fill('2');
  await expect(page.locator('select[name="type"]')).toHaveValue('mobile_sync');
  await expect(page.locator('select[name="source"]')).toHaveValue('mobile_app');
});

test('abre detalhe de importacao e navega nas abas', async ({ page }) => {
  await mockApi(page);
  await page.route('**/api/v1/projects/10/import-sessions/50/errors**', async (route: any) =>
    route.fulfill({ json: { items: [importError], page: 1, page_size: 10, total_items: 1, total_pages: 1 } }),
  );
  await page.route('**/api/v1/projects/10/import-sessions/50/files**', async (route: any) => route.fulfill({ json: [importFile] }));
  await authenticate(page);
  await page.goto('/app/projects/10/import-sessions');
  await page.getByLabel('Visualizar importacao').click();
  await expect(page.getByText('Payloads recebidos')).toBeVisible();
  await page.getByRole('button', { name: 'Erros' }).click();
  await expect(page.getByText('Item invalido')).toBeVisible();
  await page.getByRole('button', { name: 'Arquivos' }).click();
  await expect(page.getByText('raw.json')).toBeVisible();
  await expect(page.getByText('private/raw.zip')).not.toBeVisible();
});

test('filtra importacoes por status', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/import-sessions');
  await page.getByLabel('Filtrar importacao por status').selectOption('open');
  await expect(page.getByText('uuid-50')).toBeVisible();
});

test('finaliza e cancela importacao com confirmacao', async ({ page }) => {
  await mockApi(page);
  await authenticate(page);
  await page.goto('/app/projects/10/import-sessions');
  await page.getByLabel('Finalizar importacao').click();
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByText('Finalizar importacao')).not.toBeVisible();
  await page.getByLabel('Cancelar importacao').click();
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByText('Cancelar importacao')).not.toBeVisible();
});
