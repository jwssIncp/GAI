import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import { ProjectPendingIssuesPage } from './ProjectPendingIssuesPage';
import type { CurrentUser, InventoryPendingIssue, PaginatedItems } from '@/types/api';

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  resolve: vi.fn(),
  ignore: vi.fn(),
  cancel: vi.fn(),
  generate: vi.fn(),
}));

vi.mock('@/api/http', async (importOriginal) => ({ ...await importOriginal<typeof import('@/api/http')>(), api: { get: mocks.apiGet } }));

const inventoryItems = [
  { id: 11, project_id: 10, description: 'Notebook Dell', new_plate: 'PAT-0011', old_plate: null, brand: 'Dell', model: 'Latitude', serial_number: 'SN-1' },
  { id: 12, project_id: 10, description: 'Monitor LG', new_plate: null, old_plate: 'OLD-12', brand: 'LG', model: null, serial_number: null },
];
const accountingItems = [
  { id: 21, project_id: 10, description: 'Notebook contábil', plate: 'PAT-0011', base_code: 'B-1', investor_code: null, location: 'Sede' },
  { id: 22, project_id: 10, description: 'Mesa de reunião', plate: 'PAT-0022', base_code: 'B-2', investor_code: 'INV-9', location: null },
];
/** Simula a API do projeto 10: lista com busca no servidor e leitura por ID. */
function fakeApi(url: string, config?: { params?: { search?: string } }) {
  const q = (config?.params?.search ?? '').toLowerCase();
  const paged = <T,>(rows: T[]) => ({ data: { items: rows, page: 1, page_size: 20, total_items: rows.length, total_pages: 1 } });
  const routes: Array<[string, Array<{ id: number; description: string }>]> = [['/projects/10/inventory-items', inventoryItems], ['/projects/10/inventory-accounting-items', accountingItems]];
  for (const [base, rows] of routes) {
    if (url === base) return Promise.resolve(paged(rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q))));
    if (url.startsWith(base + '/')) { const row = rows.find((r) => r.id === Number(url.slice(base.length + 1))); return row ? Promise.resolve({ data: row }) : Promise.reject(new Error('404')); }
  }
  return Promise.reject(new Error('URL inesperada: ' + url));
}

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
  description: 'Placa física difere da base contábil',
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
    mocks.apiGet.mockImplementation(fakeApi);
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
    expect(screen.getAllByText('Divergência de placa').length).toBeGreaterThan(0);
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
    mocks.list.mockRejectedValue(new Error('Falha nas pendências'));
    renderPage();
    expect(await screen.findByText('Falha nas pendências')).toBeInTheDocument();
  });

  it('oculta criar e gerar sem permissao', async () => {
    renderPage(noPermissions);
    await screen.findByText('Placa divergente');
    expect(screen.queryByRole('button', { name: /nova pendência/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /gerar pendências/i })).not.toBeInTheDocument();
  });

  it('filtros chamam API com parametros corretos', async () => {
    renderPage();
    await userEvent.selectOptions(await screen.findByLabelText('Filtrar pendência por status'), 'open');
    await userEvent.selectOptions(screen.getByLabelText('Filtrar pendência por severidade'), 'high');
    await userEvent.type(screen.getByPlaceholderText('Placa'), 'PAT');
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(10, expect.objectContaining({ status: 'open', severity: 'high', plate: 'PAT' })));
  });

  it('pagina usando page/page_size', async () => {
    mocks.list.mockResolvedValue(page([issue], { total_items: 30, total_pages: 2 }));
    renderPage();
    await userEvent.click(await screen.findByLabelText('Próxima página'));
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(10, expect.objectContaining({ page: 2, page_size: 20 })));
  });

  it('detalhe renderiza dados principais', async () => {
    renderPage();
    await userEvent.click(await screen.findByLabelText('Visualizar pendência'));
    expect(await screen.findByText(/Pendência #41/)).toBeInTheDocument();
    expect(screen.getByText('Item inventariado #11')).toBeInTheDocument();
  });

  it('formulario de criacao valida campos obrigatorios', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /nova pendência/i }));
    await userEvent.clear(screen.getByLabelText('Título'));
    await userEvent.click(screen.getByRole('button', { name: /salvar pendência/i }));
    expect(await screen.findByText('Informe o título')).toBeInTheDocument();
  });

  it('resolver exige observacoes', async () => {
    renderPage();
    await userEvent.click(await screen.findByLabelText('Resolver pendência'));
    await userEvent.click(screen.getByRole('button', { name: /resolver pendência/i }));
    expect(await screen.findByText('Informe as observações da resolução')).toBeInTheDocument();
  });

  it('ignora pendencia com motivo opcional', async () => {
    renderPage();
    await userEvent.click(await screen.findByLabelText('Ignorar pendência'));
    await userEvent.type(screen.getByLabelText('Motivo ou observação'), 'Não aplicavel');
    await userEvent.click(screen.getByRole('button', { name: /ignorar pendência/i }));
    await waitFor(() => expect(mocks.ignore).toHaveBeenCalledWith(10, 41, { resolution_notes: 'Não aplicavel' }));
  });

  it('cancela com confirmacao', async () => {
    renderPage();
    await userEvent.click(await screen.findByLabelText('Cancelar pendência'));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mocks.cancel).toHaveBeenCalledWith(10, 41));
  });

  it('gera pendencias automaticamente', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /gerar pendências/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('Geração concluída: 3 criada(s), 1 ignorada(s).')).toBeInTheDocument();
  });

  it('mostra itens inventariado e contábil pelo nome e placa, nunca pelo ID', async () => {
    renderPage();
    expect(await screen.findByText('Notebook Dell (PAT-0011)')).toBeInTheDocument();
    expect(await screen.findByText('Notebook contábil (PAT-0011)')).toBeInTheDocument();
    expect(screen.queryByText('#11')).not.toBeInTheDocument();
    expect(screen.queryByText('#21')).not.toBeInTheDocument();
    expect(mocks.apiGet).toHaveBeenCalledWith('/projects/10/inventory-items/11');
    expect(mocks.apiGet).toHaveBeenCalledWith('/projects/10/inventory-accounting-items/21');
  });

  it('filtros de item são combobox com nome, buscam no projeto e enviam o ID', async () => {
    renderPage();
    await screen.findByText('Placa divergente');
    expect(screen.queryByPlaceholderText('Item inventariado ID')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Item contábil ID')).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole('combobox', { name: 'Filtrar por item inventariado' }), 'monitor');
    await waitFor(() => expect(mocks.apiGet).toHaveBeenCalledWith('/projects/10/inventory-items', { params: { page: 1, page_size: 20, search: 'monitor' } }));
    await userEvent.click(await screen.findByRole('option', { name: /Monitor LG \(OLD-12\)/ }));
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(10, expect.objectContaining({ inventory_item_id: 12, page: 1 })));
    await userEvent.type(screen.getByRole('combobox', { name: 'Filtrar por item contábil' }), 'inv-9');
    await waitFor(() => expect(mocks.apiGet).toHaveBeenCalledWith('/projects/10/inventory-accounting-items', { params: { page: 1, page_size: 20, search: 'inv-9' } }));
    await userEvent.click(await screen.findByRole('option', { name: /Mesa de reunião \(PAT-0022\)/ }));
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(10, expect.objectContaining({ inventory_item_id: 12, accounting_item_id: 22 })));
  });

  it('formulário escolhe os itens pelo nome e envia os IDs', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /nova pendência/i }));
    await userEvent.type(screen.getByLabelText('Título'), 'Conferir placa');
    await userEvent.click(screen.getByRole('combobox', { name: 'Item inventariado' }));
    await userEvent.click(await screen.findByRole('option', { name: /Monitor LG/ }));
    await userEvent.click(screen.getByRole('combobox', { name: 'Item contábil' }));
    await userEvent.click(await screen.findByRole('option', { name: /Mesa de reunião/ }));
    await userEvent.click(screen.getByRole('button', { name: /salvar pendência/i }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(10, expect.objectContaining({ title: 'Conferir placa', inventory_item_id: 12, accounting_item_id: 22 })));
  });

  it('edição carrega o rótulo dos itens já vinculados', async () => {
    renderPage();
    await userEvent.click(await screen.findByLabelText('Editar pendência'));
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Item inventariado' })).toHaveValue('Notebook Dell (PAT-0011)'));
    expect(screen.getByRole('combobox', { name: 'Item contábil' })).toHaveValue('Notebook contábil (PAT-0011)');
  });
});
