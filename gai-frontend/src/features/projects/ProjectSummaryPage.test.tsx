import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import { ProjectSummaryPage } from './ProjectSummaryPage';
import type { CurrentUser, Project, ProjectSummary } from '@/types/api';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  dashboard: vi.fn(),
  projectFieldAgentsList: vi.fn(),
  projectFieldAgentsAssign: vi.fn(),
  projectFieldAgentsRemove: vi.fn(),
}));

vi.mock('@/api/endpoints', () => ({
  projectsApi: {
    get: mocks.get,
    dashboard: mocks.dashboard,
  },
  projectFieldAgentsApi: {
    list: mocks.projectFieldAgentsList,
    assign: mocks.projectFieldAgentsAssign,
    remove: mocks.projectFieldAgentsRemove,
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
  role_assignments: [{ assignment_id: 2, role_id: 2, role_key: 'ORG_USER', role_name: 'User', role_type: 'SYSTEM', organization_id: 1, assigned_at: '2026-01-01T00:00:00.000Z' }],
};

const project: Project = {
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

const summary: ProjectSummary = {
  project: { id: 10, name: 'Projeto Alpha', status: 'active', organization_id: 1, start_date: '2026-01-01', end_date: null, created_at: '2026-01-01T00:00:00.000Z' },
  inventory: { total_items: 120, evaluated_items: 80, pending_items: 40, divergent_items: 5, not_found_items: 2, duplicated_items: 1, removed_items: 0, inactive_items: 0, progress_percentage: 66.67 },
  images: { total_images: 240, uploaded_images: 238, pending_upload_images: 2, removed_images: 0 },
  accounting: { total_accounting_items: 118, matched_accounting_items: 90, divergent_accounting_items: 8, not_found_accounting_items: 3, ignored_accounting_items: 1 },
  pending_issues: { total_pending_issues: 12, open_pending_issues: 7, in_review_pending_issues: 2, resolved_pending_issues: 3, ignored_pending_issues: 0, cancelled_pending_issues: 0, critical_pending_issues: 1, high_pending_issues: 3, medium_pending_issues: 6, low_pending_issues: 2 },
  field_agents: { total_field_agents: 4, active_field_agents: 3, inactive_field_agents: 1, finished_field_agents: 0 },
  financial: { total_payments: 5, pending_payments: 2, approved_payments: 1, paid_payments: 2, cancelled_payments: 0, total_payment_amount: '1500.00', total_expenses: 3, pending_expenses: 1, approved_expenses: 1, paid_expenses: 1, rejected_expenses: 0, cancelled_expenses: 0, total_expense_amount: '320.00', financial_total_amount: '1820.00' },
  imports: { total_import_sessions: 4, open_import_sessions: 1, processing_import_sessions: 1, finished_import_sessions: 1, failed_import_sessions: 1, cancelled_import_sessions: 0, expired_import_sessions: 0 },
  exports: { total_export_jobs: 0, pending_export_jobs: 0, processing_export_jobs: 0, finished_export_jobs: 0, failed_export_jobs: 0, cancelled_export_jobs: 0, expired_export_jobs: 0 },
  recent_activity: { last_inventory_item_created_at: '2026-01-03T00:00:00.000Z', last_inventory_item_updated_at: '2026-01-04T00:00:00.000Z', last_import_finished_at: '2026-01-05T00:00:00.000Z', last_export_finished_at: null, last_pending_issue_created_at: '2026-01-06T00:00:00.000Z', last_payment_updated_at: '2026-01-07T00:00:00.000Z' },
};

function renderPage(user: CurrentUser = admin) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const auth: AuthState = { user, accessToken: 'token', expiresAt: '2099-01-01T00:00:00.000Z', bootstrapping: false, login: vi.fn(), logout: vi.fn(), restore: vi.fn() };
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/app/projects/10/summary']}>
          <Routes>
            <Route path="/app/projects/:projectId/summary" element={<ProjectSummaryPage />} />
            <Route path="/app/projects/:projectId/inventory-items" element={<h1>Itens do projeto</h1>} />
            <Route path="/app/projects/:projectId/accounting-items" element={<h1>Base contabil</h1>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('ProjectSummaryPage workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue(project);
    mocks.dashboard.mockResolvedValue(summary);
    mocks.projectFieldAgentsList.mockResolvedValue({ items: [], page: 1, page_size: 10, total_items: 0, total_pages: 0 });
    mocks.projectFieldAgentsAssign.mockResolvedValue({});
    mocks.projectFieldAgentsRemove.mockResolvedValue({});
  });

  it('renderiza workspace com breadcrumbs, cabecalho e metricas reais', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Projeto Alpha' })).toBeInTheDocument();
    expect(screen.getByText('Projetos')).toBeInTheDocument();
    expect(screen.getByText('Inventario da filial SP')).toBeInTheDocument();
    expect(screen.getByText('Empresa #3')).toBeInTheDocument();
    expect(screen.getByText('Total de itens')).toBeInTheDocument();
    expect(screen.getByText('Pendencias criticas')).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith(10);
    expect(mocks.dashboard).toHaveBeenCalledWith(10);
  });

  it('renderiza loading', () => {
    mocks.get.mockReturnValue(new Promise(() => undefined));
    mocks.dashboard.mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByText('Carregando workspace do projeto')).toBeInTheDocument();
  });

  it('renderiza erro', async () => {
    mocks.get.mockRejectedValue(new Error('Falha no projeto'));
    renderPage();
    expect(await screen.findByText('Falha no projeto')).toBeInTheDocument();
  });

  it('renderiza projeto nao encontrado', async () => {
    mocks.get.mockRejectedValue(new Error('404 NOT_FOUND'));
    renderPage();
    expect(await screen.findByText('Projeto nao encontrado')).toBeInTheDocument();
  });

  it('oculta card e atalho quando usuario nao possui permissao', async () => {
    renderPage(noPermissions);
    expect(await screen.findByRole('heading', { name: 'Projeto Alpha' })).toBeInTheDocument();
    expect(screen.queryByText('Acoes rapidas')).toBeInTheDocument();
    expect(screen.queryByText('Novo item')).not.toBeInTheDocument();
    expect(screen.queryByText('Itens inventariados')).not.toBeInTheDocument();
  });

  it('navega entre abas e atalho novo item', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('link', { name: 'Itens' }));
    expect(await screen.findByRole('heading', { name: 'Itens do projeto' })).toBeInTheDocument();
  });

  it('atalho importar base contabil redireciona para o fluxo existente', async () => {
    renderPage();
    await userEvent.click(await screen.findByText('Importar base contabil'));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Base contabil' })).toBeInTheDocument());
  });

  it('sinaliza projeto finalizado e bloqueia acoes operacionais', async () => {
    mocks.get.mockResolvedValue({ ...project, status: 'finished' });
    mocks.dashboard.mockResolvedValue({ ...summary, project: { ...summary.project, status: 'finished' } });
    renderPage();
    expect(await screen.findByText('Projeto bloqueado operacionalmente')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /novo item/i })).toBeDisabled();
  });
});
