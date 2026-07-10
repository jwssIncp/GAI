import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import { ProjectAccountingItemsPage } from './ProjectAccountingItemsPage';
import type { AccountingImportBatch, CurrentUser, InventoryAccountingItem, PaginatedItems } from '@/types/api';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  deactivate: vi.fn(),
  reactivate: vi.fn(),
  importFile: vi.fn(),
  listImports: vi.fn(),
  errors: vi.fn(),
}));

vi.mock('@/api/endpoints', () => ({
  accountingItemsApi: {
    list: mocks.list,
    get: mocks.get,
    update: mocks.update,
    deactivate: mocks.deactivate,
    reactivate: mocks.reactivate,
  },
  accountingImportsApi: {
    importFile: mocks.importFile,
    list: mocks.listImports,
    errors: mocks.errors,
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

const item: InventoryAccountingItem = {
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

const batch: AccountingImportBatch = {
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

function page<T>(items: T[], overrides: Partial<PaginatedItems<T>> = {}): PaginatedItems<T> {
  return { items, page: 1, page_size: 20, total_items: items.length, total_pages: items.length ? 1 : 0, ...overrides };
}

function renderPage(user: CurrentUser = admin) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const auth: AuthState = { user, accessToken: 'token', expiresAt: '2099-01-01T00:00:00.000Z', bootstrapping: false, login: vi.fn(), logout: vi.fn(), restore: vi.fn() };
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/app/projects/10/accounting-items']}>
          <Routes>
            <Route path="/app/projects/:projectId/accounting-items" element={<ProjectAccountingItemsPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('ProjectAccountingItemsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue(page([item]));
    mocks.get.mockResolvedValue(item);
    mocks.update.mockResolvedValue(item);
    mocks.deactivate.mockResolvedValue({ ...item, status: 'inactive' });
    mocks.reactivate.mockResolvedValue({ ...item, status: 'pending' });
    mocks.importFile.mockResolvedValue(batch);
    mocks.listImports.mockResolvedValue(page([batch], { page_size: 5 }));
    mocks.errors.mockResolvedValue({ items: [{ row: 3, errors: ['Placa obrigatoria'] }] });
  });

  it('renderiza listagem da base contabil', async () => {
    renderPage();
    expect(await screen.findByText('Notebook contabil')).toBeInTheDocument();
    expect(screen.getByText('PAT-001')).toBeInTheDocument();
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
    mocks.list.mockRejectedValue(new Error('Falha contabil'));
    renderPage();
    expect(await screen.findByText('Falha contabil')).toBeInTheDocument();
  });

  it('oculta importar sem permissao', async () => {
    renderPage(noPermissions);
    await screen.findByText('Notebook contabil');
    expect(screen.queryByRole('button', { name: /importar xlsx/i })).not.toBeInTheDocument();
  });

  it('valida arquivo invalido', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /importar xlsx/i }));
    await userEvent.upload(screen.getByLabelText('Selecionar XLSX contabil'), new File(['x'], 'base.csv', { type: 'text/csv' }), { applyAccept: false });
    expect(await screen.findByText('Envie um arquivo .xlsx valido.')).toBeInTheDocument();
    expect(mocks.importFile).not.toHaveBeenCalled();
  });

  it('filtros chamam API com parametros corretos', async () => {
    renderPage();
    await userEvent.selectOptions(await screen.findByLabelText('Filtrar base contabil por status'), 'matched');
    await userEvent.type(screen.getByPlaceholderText('Placa'), 'PAT');
    await userEvent.type(screen.getByPlaceholderText('Codigo base'), 'BASE');
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(10, expect.objectContaining({ status: 'matched', plate: 'PAT', base_code: 'BASE' })));
  });

  it('pagina usando page/page_size', async () => {
    mocks.list.mockResolvedValue(page([item], { total_items: 30, total_pages: 2 }));
    renderPage();
    await userEvent.click(await screen.findByLabelText('Proxima pagina'));
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(10, expect.objectContaining({ page: 2, page_size: 20 })));
  });

  it('detalhe renderiza dados principais', async () => {
    renderPage();
    await userEvent.click(await screen.findByLabelText('Visualizar item contabil'));
    expect(await screen.findByText('Item contabil #21 - Projeto #10')).toBeInTheDocument();
    expect(screen.getAllByText('Sala 20').length).toBeGreaterThan(0);
  });

  it('edicao valida valor monetario', async () => {
    renderPage();
    await userEvent.click(await screen.findByLabelText('Editar item contabil'));
    await userEvent.clear(screen.getByLabelText('Valor de aquisicao'));
    await userEvent.type(screen.getByLabelText('Valor de aquisicao'), '12,345');
    await userEvent.click(screen.getByRole('button', { name: /atualizar item contabil/i }));
    expect(await screen.findByText('Valor deve seguir o formato 9999999999999.99')).toBeInTheDocument();
  });

  it('desativa com confirmacao', async () => {
    renderPage();
    await userEvent.click(await screen.findByLabelText('Desativar item contabil'));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mocks.deactivate).toHaveBeenCalledWith(10, 21));
  });

  it('renderiza historico e erros de importacao', async () => {
    renderPage();
    expect(await screen.findByText('base.xlsx')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Visualizar erros da importacao'));
    expect(await screen.findByText('Linha 3')).toBeInTheDocument();
    expect(screen.getByText('Placa obrigatoria')).toBeInTheDocument();
  });
});
