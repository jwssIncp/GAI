import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import { ProjectFinancePage } from './ProjectFinancePage';
import type { CurrentUser, Expense, ExpenseAttachment, FieldAgent, FieldAgentPayment, PaginatedItems } from '@/types/api';

const mocks = vi.hoisted(() => ({
  paymentsList: vi.fn(),
  paymentSummary: vi.fn(),
  paymentCreate: vi.fn(),
  paymentUpdate: vi.fn(),
  paymentApprove: vi.fn(),
  paymentMarkAsPaid: vi.fn(),
  paymentCancel: vi.fn(),
  expensesList: vi.fn(),
  expenseCreate: vi.fn(),
  expenseUpdate: vi.fn(),
  expenseApprove: vi.fn(),
  expenseReject: vi.fn(),
  expenseMarkAsPaid: vi.fn(),
  expenseCancel: vi.fn(),
  fieldAgentsList: vi.fn(),
  attachmentsList: vi.fn(),
  createUploadUrl: vi.fn(),
  confirmUpload: vi.fn(),
  downloadUrl: vi.fn(),
  removeAttachment: vi.fn(),
  uploadToPresignedUrl: vi.fn(),
}));

vi.mock('@/api/http', () => ({ uploadToPresignedUrl: mocks.uploadToPresignedUrl }));
vi.mock('@/api/endpoints', () => ({
  fieldAgentsApi: { list: mocks.fieldAgentsList },
  paymentsApi: {
    list: mocks.paymentsList,
    summary: mocks.paymentSummary,
    create: mocks.paymentCreate,
    update: mocks.paymentUpdate,
    approve: mocks.paymentApprove,
    markAsPaid: mocks.paymentMarkAsPaid,
    cancel: mocks.paymentCancel,
  },
  expensesApi: {
    list: mocks.expensesList,
    create: mocks.expenseCreate,
    update: mocks.expenseUpdate,
    approve: mocks.expenseApprove,
    reject: mocks.expenseReject,
    markAsPaid: mocks.expenseMarkAsPaid,
    cancel: mocks.expenseCancel,
  },
  expenseAttachmentsApi: {
    list: mocks.attachmentsList,
    createUploadUrl: mocks.createUploadUrl,
    confirmUpload: mocks.confirmUpload,
    downloadUrl: mocks.downloadUrl,
    remove: mocks.removeAttachment,
  },
}));

const admin: CurrentUser = {
  id: 1,
  login: 'admin',
  email: 'admin@gai.local',
  status: 'ACTIVE',
  organization_id: 1,
  role_assignments: [{ assignment_id: 1, role_id: 1, role_key: 'ORG_ADMIN', role_name: 'Admin', role_type: 'SYSTEM', organization_id: 1, assigned_at: '2026-01-01T00:00:00.000Z' }],
};

const noPermissions: CurrentUser = {
  ...admin,
  role_assignments: [{ assignment_id: 2, role_id: 3, role_key: 'ORG_USER', role_name: 'User', role_type: 'SYSTEM', organization_id: 1, assigned_at: '2026-01-01T00:00:00.000Z' }],
};

const agent: FieldAgent = {
  id: 7,
  organization_id: 1,
  name: 'Ana Inventariante',
  email: 'ana@gai.local',
  phone: null,
  document: null,
  status: 'active',
  metadata: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const payment: FieldAgentPayment = {
  id: 10,
  organization_id: 1,
  project_id: 20,
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

const expense: Expense = {
  id: 15,
  organization_id: 1,
  project_id: 20,
  field_agent_id: 7,
  description: 'Almoco em campo',
  reason: 'Equipe em inventário',
  expense_date: '2026-01-02',
  amount: '45.90',
  status: 'pending',
  metadata: null,
  created_at: '2026-01-02T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
};

const attachment: ExpenseAttachment = {
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

function page<T>(items: T[], overrides: Partial<PaginatedItems<T>> = {}): PaginatedItems<T> {
  return { items, page: 1, page_size: 20, total_items: items.length, total_pages: items.length ? 1 : 0, ...overrides };
}

function renderPage(user: CurrentUser = admin, path = '/app/projects/20/finance') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const auth: AuthState = { user, accessToken: 'token', expiresAt: '2099-01-01T00:00:00.000Z', bootstrapping: false, login: vi.fn(), logout: vi.fn(), restore: vi.fn() };
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/app/projects/:projectId/finance" element={<ProjectFinancePage />} />
            <Route path="/app/projects/:projectId/finance/remuneration" element={<p>Remuneração (destino do redirecionamento)</p>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('ProjectFinancePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fieldAgentsList.mockResolvedValue(page([agent]));
    mocks.paymentSummary.mockResolvedValue({ total_pending: '320.00', total_approved: '0.00', total_paid: '0.00', total_cancelled: '0.00', total_count: 1 });
    mocks.paymentsList.mockResolvedValue(page([payment]));
    mocks.paymentCreate.mockResolvedValue(payment);
    mocks.paymentUpdate.mockResolvedValue(payment);
    mocks.paymentApprove.mockResolvedValue({ ...payment, status: 'approved' });
    mocks.paymentMarkAsPaid.mockResolvedValue({ ...payment, status: 'paid' });
    mocks.paymentCancel.mockResolvedValue({ ...payment, status: 'cancelled' });
    mocks.expensesList.mockResolvedValue(page([expense]));
    mocks.expenseCreate.mockResolvedValue(expense);
    mocks.expenseUpdate.mockResolvedValue(expense);
    mocks.expenseApprove.mockResolvedValue({ ...expense, status: 'approved' });
    mocks.expenseReject.mockResolvedValue({ ...expense, status: 'rejected' });
    mocks.expenseMarkAsPaid.mockResolvedValue({ ...expense, status: 'paid' });
    mocks.expenseCancel.mockResolvedValue({ ...expense, status: 'cancelled' });
    mocks.attachmentsList.mockResolvedValue([attachment]);
    mocks.createUploadUrl.mockResolvedValue({ attachment: { ...attachment, id: 81, original_name: 'novo.pdf', status: 'pending_upload' }, upload_url: 'https://upload.example/proof', expires_in_seconds: 300 });
    mocks.confirmUpload.mockResolvedValue({ ...attachment, id: 81, original_name: 'novo.pdf' });
    mocks.downloadUrl.mockResolvedValue({ attachment, download_url: 'https://signed.example/recibo.pdf', expires_in_seconds: 300 });
    mocks.removeAttachment.mockResolvedValue({ ...attachment, status: 'removed' });
    mocks.uploadToPresignedUrl.mockResolvedValue(undefined);
  });

  it('?tab=payments (endereço antigo) redireciona para Remuneração', async () => {
    renderPage(admin, '/app/projects/20/finance?tab=payments');
    expect(await screen.findByText('Remuneração (destino do redirecionamento)')).toBeInTheDocument();
  });

  it('a aba Despesas mostra só as despesas, sem a lista de diárias', async () => {
    renderPage();
    expect(await screen.findByText('Almoco em campo')).toBeInTheDocument();
    expect(screen.queryByText('Pagamento #10')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Despesas' })).toBeInTheDocument();
  });

  it('oculta criação de despesa para usuário sem permissão', async () => {
    renderPage(noPermissions);
    await screen.findByText('Almoco em campo');
    expect(screen.queryByRole('button', { name: /nova despesa/i })).not.toBeInTheDocument();
  });

  it('valida formulario de despesa', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /nova despesa/i }));
    await userEvent.click(screen.getByRole('button', { name: /criar despesa/i }));
    expect(await screen.findByText('Descreva a despesa')).toBeInTheDocument();
  });

  it('rejeita despesa com motivo obrigatorio', async () => {
    renderPage();
    await userEvent.click(await screen.findByLabelText('Rejeitar despesa'));
    await userEvent.click(screen.getByRole('button', { name: /rejeitar despesa/i }));
    expect(await screen.findByText('Informe o motivo da rejeição')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Motivo'), 'Sem comprovante');
    await userEvent.click(screen.getByRole('button', { name: /rejeitar despesa/i }));
    await waitFor(() => expect(mocks.expenseReject).toHaveBeenCalledWith(20, 15, { reason: 'Sem comprovante' }));
  });

  it('envia comprovante usando upload-url e confirm-upload', async () => {
    renderPage();
    await userEvent.click(await screen.findByLabelText('Comprovantes da despesa'));
    const file = new File(['conteúdo'], 'novo.pdf', { type: 'application/pdf' });
    await userEvent.upload(await screen.findByLabelText('Enviar comprovante'), file);
    await waitFor(() => expect(mocks.createUploadUrl).toHaveBeenCalledWith(20, 15, expect.objectContaining({ original_name: 'novo.pdf', mime_type: 'application/pdf' })));
    expect(mocks.uploadToPresignedUrl).toHaveBeenCalledWith('https://upload.example/proof', file, expect.any(Function));
    await waitFor(() => expect(mocks.confirmUpload).toHaveBeenCalledWith(20, 15, 81, { size_bytes: file.size }));
  });
});
