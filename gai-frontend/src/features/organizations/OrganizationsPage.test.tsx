import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/http';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import { OrganizationsPage } from './OrganizationsPage';
import type { CurrentUser, Organization, PaginatedItems } from '@/types/api';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  deactivate: vi.fn(),
  activate: vi.fn(),
}));

vi.mock('@/api/endpoints', () => ({
  organizationsApi: {
    list: mocks.list,
    create: mocks.create,
    get: mocks.get,
    update: mocks.update,
    deactivate: mocks.deactivate,
    activate: mocks.activate,
  },
}));

const platformAdmin: CurrentUser = {
  id: 1,
  login: 'platform.admin',
  email: 'admin@gai.local',
  status: 'ACTIVE',
  organization_id: null,
  role_assignments: [
    {
      assignment_id: 1,
      role_id: 1,
      role_key: 'PLATFORM_ADMIN',
      role_name: 'Platform',
      role_type: 'SYSTEM',
      organization_id: null,
      assigned_at: '2026-01-01T00:00:00.000Z',
    },
  ],
};

const platformAdminWithPermissions: CurrentUser = {
  ...platformAdmin,
  permissions: [
    { key: 'organizations:read', scope: 'PLATFORM' },
    { key: 'organizations:write', scope: 'PLATFORM' },
  ],
};

const orgUser: CurrentUser = {
  ...platformAdmin,
  organization_id: 1,
  role_assignments: [
    {
      assignment_id: 3,
      role_id: 3,
      role_key: 'ORG_USER',
      role_name: 'User',
      role_type: 'SYSTEM',
      organization_id: 1,
      assigned_at: '2026-01-01T00:00:00.000Z',
    },
  ],
};

const organization: Organization = {
  id: 7,
  legal_name: 'Empresa Exemplo Ltda',
  trade_name: 'Exemplo',
  cnpj: '11222333000181',
  contact_email: 'contato@exemplo.com.br',
  contact_phone: '11999998888',
  status: 'ACTIVE',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function page(items: Organization[], overrides: Partial<PaginatedItems<Organization>> = {}): PaginatedItems<Organization> {
  return {
    items,
    page: 1,
    page_size: 20,
    total_items: items.length,
    total_pages: items.length ? 1 : 0,
    ...overrides,
  };
}

function renderWithProviders(ui: React.ReactElement, user: CurrentUser = platformAdmin) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const auth: AuthState = {
    user,
    accessToken: 'token',
    expiresAt: '2099-01-01T00:00:00.000Z',
    bootstrapping: false,
    login: vi.fn(),
    logout: vi.fn(),
    restore: vi.fn(),
  };
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('OrganizationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue(page([organization]));
    mocks.get.mockResolvedValue(organization);
    mocks.create.mockResolvedValue(organization);
    mocks.update.mockResolvedValue(organization);
    mocks.deactivate.mockResolvedValue({ ...organization, status: 'INACTIVE' });
    mocks.activate.mockResolvedValue({ ...organization, status: 'ACTIVE' });
  });

  it('renderiza listagem de organizações', async () => {
    renderWithProviders(<OrganizationsPage />);
    expect(await screen.findByText('Empresa Exemplo Ltda')).toBeInTheDocument();
    expect(screen.getByText('contato@exemplo.com.br')).toBeInTheDocument();
  });

  it('renderiza estado de loading', () => {
    mocks.list.mockReturnValue(new Promise(() => undefined));
    renderWithProviders(<OrganizationsPage />);
    expect(screen.getByText('Carregando dados')).toBeInTheDocument();
  });

  it('renderiza estado vazio', async () => {
    mocks.list.mockResolvedValue(page([]));
    renderWithProviders(<OrganizationsPage />);
    expect(await screen.findByText('Nenhum registro encontrado')).toBeInTheDocument();
  });

  it('renderiza estado de erro', async () => {
    mocks.list.mockRejectedValue(new Error('Falha de rede'));
    renderWithProviders(<OrganizationsPage />);
    expect(await screen.findByText('Falha de rede')).toBeInTheDocument();
  });

  it('mostra botão de criar com organizations:write', async () => {
    renderWithProviders(<OrganizationsPage />, platformAdminWithPermissions);
    expect(await screen.findByRole('button', { name: /nova organização/i })).toBeInTheDocument();
  });

  it('oculta botão de criar sem permissão', async () => {
    renderWithProviders(<OrganizationsPage />, orgUser);
    await screen.findByText('Empresa Exemplo Ltda');
    expect(screen.queryByRole('button', { name: /nova organização/i })).not.toBeInTheDocument();
  });

  it('valida formulário de criação', async () => {
    renderWithProviders(<OrganizationsPage />);
    await userEvent.click(await screen.findByRole('button', { name: /nova organização/i }));
    await userEvent.click(screen.getByRole('button', { name: /salvar organização/i }));
    expect(await screen.findByText('Razão social deve ter pelo menos 2 caracteres')).toBeInTheDocument();
    expect(screen.getByText('Informe o CNPJ')).toBeInTheDocument();
  });

  it('cria organização normalizando CNPJ e telefone', async () => {
    renderWithProviders(<OrganizationsPage />);
    await userEvent.click(await screen.findByRole('button', { name: /nova organização/i }));
    await userEvent.type(screen.getByLabelText('Razão social'), 'Nova Org Ltda');
    await userEvent.type(screen.getByLabelText('CNPJ'), '11.222.333/0001-81');
    await userEvent.type(screen.getByLabelText('Telefone'), '(11) 99999-8888');
    await userEvent.click(screen.getByRole('button', { name: /salvar organização/i }));
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          legal_name: 'Nova Org Ltda',
          cnpj: '11222333000181',
          contact_phone: '11999998888',
        }),
      ),
    );
  });

  it('mostra conflito de CNPJ no campo e preserva o formulário', async () => {
    mocks.create.mockRejectedValueOnce(
      new ApiError(409, {
        code: 'CONFLICT',
        message: 'CNPJ duplicado',
        details: [{ field: 'cnpj', message: 'CNPJ já cadastrado' }],
      }),
    );
    renderWithProviders(<OrganizationsPage />);
    await userEvent.click(await screen.findByRole('button', { name: /nova organização/i }));
    await userEvent.type(screen.getByLabelText('Razão social'), 'Nova Org Ltda');
    await userEvent.type(screen.getByLabelText('CNPJ'), '11222333000181');
    await userEvent.click(screen.getByRole('button', { name: /salvar organização/i }));
    expect(await screen.findByText('CNPJ já cadastrado')).toBeInTheDocument();
    expect(screen.getByLabelText('Razão social')).toHaveValue('Nova Org Ltda');
  });

  it('edita organização sem permitir alterar CNPJ', async () => {
    renderWithProviders(<OrganizationsPage />);
    await userEvent.click(await screen.findByLabelText('Editar organização'));
    expect(screen.getByDisplayValue('11.222.333/0001-81')).toBeDisabled();
    await userEvent.clear(screen.getByLabelText('Razão social'));
    await userEvent.type(screen.getByLabelText('Razão social'), 'Empresa Atualizada Ltda');
    await userEvent.click(screen.getByRole('button', { name: /atualizar organização/i }));
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(7, expect.objectContaining({ legal_name: 'Empresa Atualizada Ltda' })),
    );
    expect(mocks.update.mock.calls[0][1]).not.toHaveProperty('cnpj');
  });

  it('desativa organização com confirmação', async () => {
    renderWithProviders(<OrganizationsPage />);
    await userEvent.click(await screen.findByLabelText('Desativar organização'));
    expect(screen.getByText('Desativar organização')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mocks.deactivate).toHaveBeenCalledWith(7));
  });

  it('reativa organização com confirmação', async () => {
    mocks.list.mockResolvedValue(page([{ ...organization, status: 'INACTIVE' }]));
    renderWithProviders(<OrganizationsPage />);
    await userEvent.click(await screen.findByLabelText('Reativar organização'));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mocks.activate).toHaveBeenCalledWith(7));
  });

  it('abre detalhes da organização', async () => {
    renderWithProviders(<OrganizationsPage />);
    await userEvent.click(await screen.findByLabelText('Visualizar organização'));
    expect(await screen.findByRole('heading', { name: 'Detalhes da organização' })).toBeInTheDocument();
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith(7));
  });

  it('paginação chama API com page/page_size', async () => {
    mocks.list.mockResolvedValue(page([organization], { total_items: 30, total_pages: 2 }));
    renderWithProviders(<OrganizationsPage />);
    await userEvent.click(await screen.findByLabelText('Proxima pagina'));
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, page_size: 20 })));
  });

  it('filtra por status', async () => {
    renderWithProviders(<OrganizationsPage />);
    await screen.findByText('Empresa Exemplo Ltda');
    await userEvent.selectOptions(screen.getByLabelText('Filtrar por status'), 'INACTIVE');
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'INACTIVE', page: 1 })));
  });
});
