import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import { ProjectPendingIssuesPage } from './ProjectPendingIssuesPage';
import type { CurrentUser, InventoryPendingIssue, PaginatedItems } from '@/types/api';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  resolve: vi.fn(),
  ignore: vi.fn(),
  cancel: vi.fn(),
  generate: vi.fn(),
}));

vi.mock('@/api/endpoints', () => ({
  pendingIssuesApi: {
    list: mocks.list,
    create: mocks.create,
    get: mocks.get,
    update: mocks.update,
    resolve: mocks.resolve,
    ignore: mocks.ignore,
    cancel: mocks.cancel,
    generate: mocks.generate,
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

const issue: InventoryPendingIssue = {
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

function page<T>(items: T[], overrides: Partial<PaginatedItems<T>> = {}): PaginatedItems<T> {
  return { items, page: 1, page_size: 20, total_items: items.length, total_pages: items.length ? 1 : 0, ...overrides };
}

function renderPage(user: CurrentUser = admin) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const auth: AuthState = { user, accessToken: 'token', expiresAt: '2099-01-01T00:00:00.000Z', bootstrapping: false, login: vi.fn(), logout: vi.fn(), restore: vi.fn() };
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/app/projects/10/pending-issues']}>
          <Routes>
            <Route path="/app/projects/:projectId/pending-issues" element={<ProjectPendingIssuesPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('ProjectPendingIssuesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue(page([issue]));
    mocks.get.mockResolvedValue(issue);
    mocks.create.mockResolvedValue(issue);
    mocks.update.mockResolvedValue(issue);
    mocks.resolve.mockResolvedValue({ ...issue, status: 'resolved', resolution_notes: 'Conferido' });
    mocks.ignore.mockResolvedValue({ ...issue, status: 'ignored' });
    mocks.cancel.mockResolvedValue({ ...issue, status: 'cancelled' });
    mocks.generate.mockResolvedValue({ created: 3, skipped: 1 });
  });

  it('renderiza listagem de pendencias', async () => {
    renderPage();
    expect(await screen.findByText('Placa divergente')).toBeInTheDocument();
    expect(screen.getAllByText('Divergencia de placa').length).toBeGreaterThan(0);
  });

  it('renderiza loading', () => {
    mocks.list.mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByText('Carregando dados')).toBeInTheDocument();
  });

  it('renderiza vazio', async () => {
    mocks.list.mockResolvedValue(page([]));
    renderPage();
    expect(await screen.findByText('Nenhum registro encontrado')).toBeInTheDocument();
  });

  it('renderiza erro', async () => {
    mocks.list.mockRejectedValue(new Error('Falha nas pendencias'));
    renderPage();
    expect(await screen.findByText('Falha nas pendencias')).toBeInTheDocument();
  });

  it('oculta criar e gerar sem permissao', async () => {
    renderPage(noPermissions);
    await screen.findByText('Placa divergente');
    expect(screen.queryByRole('button', { name: /nova pendencia/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /gerar pendencias/i })).not.toBeInTheDocument();
  });

  it('filtros chamam API com parametros corretos', async () => {
    renderPage();
    await userEvent.selectOptions(await screen.findByLabelText('Filtrar pendencia por status'), 'open');
    await userEvent.selectOptions(screen.getByLabelText('Filtrar pendencia por severidade'), 'high');
    await userEvent.type(screen.getByPlaceholderText('Placa'), 'PAT');
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(10, expect.objectContaining({ status: 'open', severity: 'high', plate: 'PAT' })));
  });

  it('pagina usando page/page_size', async () => {
    mocks.list.mockResolvedValue(page([issue], { total_items: 30, total_pages: 2 }));
    renderPage();
    await userEvent.click(await screen.findByLabelText('Proxima pagina'));
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(10, expect.objectContaining({ page: 2, page_size: 20 })));
  });

  it('detalhe renderiza dados principais', async () => {
    renderPage();
    await userEvent.click(await screen.findByLabelText('Visualizar pendencia'));
    expect(await screen.findByText(/Pendencia #41/)).toBeInTheDocument();
    expect(screen.getByText('Item inventariado #11')).toBeInTheDocument();
  });

  it('formulario de criacao valida campos obrigatorios', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /nova pendencia/i }));
    await userEvent.clear(screen.getByLabelText('Titulo'));
    await userEvent.click(screen.getByRole('button', { name: /salvar pendencia/i }));
    expect(await screen.findByText('Informe o titulo')).toBeInTheDocument();
  });

  it('resolver exige observacoes', async () => {
    renderPage();
    await userEvent.click(await screen.findByLabelText('Resolver pendencia'));
    await userEvent.click(screen.getByRole('button', { name: /resolver pendencia/i }));
    expect(await screen.findByText('Informe as observacoes da resolucao')).toBeInTheDocument();
  });

  it('ignora pendencia com motivo opcional', async () => {
    renderPage();
    await userEvent.click(await screen.findByLabelText('Ignorar pendencia'));
    await userEvent.type(screen.getByLabelText('Motivo ou observacao'), 'Nao aplicavel');
    await userEvent.click(screen.getByRole('button', { name: /ignorar pendencia/i }));
    await waitFor(() => expect(mocks.ignore).toHaveBeenCalledWith(10, 41, { resolution_notes: 'Nao aplicavel' }));
  });

  it('cancela com confirmacao', async () => {
    renderPage();
    await userEvent.click(await screen.findByLabelText('Cancelar pendencia'));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mocks.cancel).toHaveBeenCalledWith(10, 41));
  });

  it('gera pendencias automaticamente', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /gerar pendencias/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('Geracao concluida: 3 criada(s), 1 ignorada(s).')).toBeInTheDocument();
  });
});
