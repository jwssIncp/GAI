import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import { ProjectInventoryItemsPage } from './ProjectInventoryItemsPage';
import type { CurrentUser, InventoryItem, PaginatedItems } from '@/types/api';

const mocks = vi.hoisted(() => ({
  listByProject: vi.fn(),
  create: vi.fn(),
  getByProject: vi.fn(),
  update: vi.fn(),
  deactivate: vi.fn(),
  reactivate: vi.fn(),
  images: vi.fn(),
}));

vi.mock('@/api/endpoints', () => ({
  inventoryItemsApi: {
    listByProject: mocks.listByProject,
    create: mocks.create,
    getByProject: mocks.getByProject,
    update: mocks.update,
    deactivate: mocks.deactivate,
    reactivate: mocks.reactivate,
  },
  inventoryItemImagesApi: { list: mocks.images },
}));

const admin: CurrentUser = {
  id: 1,
  login: 'platform.admin',
  email: 'admin@gai.local',
  status: 'ACTIVE',
  organization_id: null,
  role_assignments: [{ assignment_id: 1, role_id: 1, role_key: 'PLATFORM_ADMIN', role_name: 'Platform', role_type: 'SYSTEM', organization_id: null, assigned_at: '2026-01-01T00:00:00.000Z' }],
};

const noCreate: CurrentUser = { ...admin, role_assignments: [{ assignment_id: 2, role_id: 3, role_key: 'ORG_USER', role_name: 'User', role_type: 'SYSTEM', organization_id: 1, assigned_at: '2026-01-01T00:00:00.000Z' }] };

const item: InventoryItem = {
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

function page(items: InventoryItem[], overrides: Partial<PaginatedItems<InventoryItem>> = {}): PaginatedItems<InventoryItem> {
  return { items, page: 1, page_size: 20, total_items: items.length, total_pages: items.length ? 1 : 0, ...overrides };
}

function renderPage(user: CurrentUser = admin) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const auth: AuthState = { user, accessToken: 'token', expiresAt: '2099-01-01T00:00:00.000Z', bootstrapping: false, login: vi.fn(), logout: vi.fn(), restore: vi.fn() };
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/app/projects/10/inventory-items']}>
          <Routes>
            <Route path="/app/projects/:projectId/inventory-items" element={<ProjectInventoryItemsPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('ProjectInventoryItemsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listByProject.mockResolvedValue(page([item]));
    mocks.getByProject.mockResolvedValue(item);
    mocks.images.mockResolvedValue({ items: [], page: 1, page_size: 6, total_items: 0, total_pages: 0 });
    mocks.create.mockResolvedValue(item);
    mocks.deactivate.mockResolvedValue({ ...item, status: 'inactive' });
  });

  it('renderiza listagem de itens', async () => {
    renderPage();
    expect(await screen.findByText('Notebook Dell')).toBeInTheDocument();
    expect(screen.getByText('OLD-1')).toBeInTheDocument();
  });

  it('renderiza loading', () => {
    mocks.listByProject.mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByText('Carregando dados')).toBeInTheDocument();
  });

  it('renderiza vazio', async () => {
    mocks.listByProject.mockResolvedValue(page([]));
    renderPage();
    expect(await screen.findByText('Nenhum registro encontrado')).toBeInTheDocument();
  });

  it('renderiza erro', async () => {
    mocks.listByProject.mockRejectedValue(new Error('Falha ao carregar'));
    renderPage();
    expect(await screen.findByText('Falha ao carregar')).toBeInTheDocument();
  });

  it('valida formulario de criacao', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /novo item/i }));
    await userEvent.click(screen.getByRole('button', { name: /salvar item/i }));
    expect(await screen.findByText('Informe a descricao do item')).toBeInTheDocument();
  });

  it('oculta criar sem permissao', async () => {
    renderPage(noCreate);
    await screen.findByText('Notebook Dell');
    expect(screen.queryByRole('button', { name: /novo item/i })).not.toBeInTheDocument();
  });

  it('desativa com confirmacao', async () => {
    renderPage();
    await userEvent.click(await screen.findByLabelText('Desativar item'));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mocks.deactivate).toHaveBeenCalledWith(10, 11));
  });

  it('pagina chamando page/page_size', async () => {
    mocks.listByProject.mockResolvedValue(page([item], { total_items: 30, total_pages: 2 }));
    renderPage();
    await userEvent.click(await screen.findByLabelText('Proxima pagina'));
    await waitFor(() => expect(mocks.listByProject).toHaveBeenLastCalledWith(10, expect.objectContaining({ page: 2, page_size: 20 })));
  });

  it('filtros chamam API com parametros reais', async () => {
    renderPage();
    await userEvent.selectOptions(await screen.findByLabelText('Filtrar por status'), 'evaluated');
    await userEvent.type(screen.getByPlaceholderText('Placa antiga'), 'ABC');
    await waitFor(() => expect(mocks.listByProject).toHaveBeenLastCalledWith(10, expect.objectContaining({ status: 'evaluated', old_plate: 'ABC' })));
  });

  it('detalhe renderiza dados principais', async () => {
    renderPage();
    await userEvent.click(await screen.findByLabelText('Visualizar item'));
    expect(await screen.findByText('Item #11 - Projeto #10')).toBeInTheDocument();
    expect(screen.getAllByText('Sala 10').length).toBeGreaterThan(0);
  });
});
