import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import { ApiError } from '@/api/http';
import { FieldAgentsPage } from './FieldAgentsPage';
import { ProjectFieldAgentsPanel } from './ProjectFieldAgentsPanel';
import type { CurrentUser, FieldAgent, PaginatedItems, ProjectFieldAgent } from '@/types/api';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  deactivate: vi.fn(),
  reactivate: vi.fn(),
  block: vi.fn(),
  unblock: vi.fn(),
  delete: vi.fn(),
  projectList: vi.fn(),
  assign: vi.fn(),
  remove: vi.fn(),
  projectUpdate: vi.fn(),
}));

vi.mock('@/api/endpoints', () => ({
  fieldAgentsApi: {
    list: mocks.list,
    create: mocks.create,
    get: mocks.get,
    update: mocks.update,
    deactivate: mocks.deactivate,
    reactivate: mocks.reactivate,
    block: mocks.block,
    unblock: mocks.unblock,
    delete: mocks.delete,
  },
  projectFieldAgentsApi: {
    list: mocks.projectList,
    assign: mocks.assign,
    remove: mocks.remove,
    update: mocks.projectUpdate,
  },
}));

const platformUser: CurrentUser = {
  id: 1,
  login: 'platform.admin',
  email: 'admin@gai.local',
  status: 'ACTIVE',
  organization_id: null,
  role_assignments: [{ assignment_id: 1, role_id: 1, role_key: 'PLATFORM_ADMIN', role_name: 'Platform', role_type: 'SYSTEM', organization_id: null, assigned_at: '2026-01-01T00:00:00.000Z' }],
};

const orgAdmin: CurrentUser = { ...platformUser, organization_id: 1, role_assignments: [{ assignment_id: 2, role_id: 2, role_key: 'ORG_ADMIN', role_name: 'Admin', role_type: 'SYSTEM', organization_id: 1, assigned_at: '2026-01-01T00:00:00.000Z' }] };
const orgUser: CurrentUser = { ...orgAdmin, role_assignments: [{ assignment_id: 3, role_id: 3, role_key: 'ORG_USER', role_name: 'User', role_type: 'SYSTEM', organization_id: 1, assigned_at: '2026-01-01T00:00:00.000Z' }] };

const agent: FieldAgent = {
  id: 7,
  organization_id: 1,
  user_id: 22,
  name: 'Ana Inventariante',
  email: 'ana@gai.local',
  phone: '11999998888',
  document: '12345678900',
  status: 'active',
  metadata: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function page(items: FieldAgent[], overrides: Partial<PaginatedItems<FieldAgent>> = {}): PaginatedItems<FieldAgent> {
  return { items, page: 1, page_size: 20, total_items: items.length, total_pages: items.length ? 1 : 0, ...overrides };
}

function renderWithProviders(ui: React.ReactElement, user: CurrentUser = orgAdmin) {
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

describe('FieldAgentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue(page([agent]));
    mocks.get.mockResolvedValue(agent);
    mocks.create.mockResolvedValue(agent);
    mocks.deactivate.mockResolvedValue({ ...agent, status: 'inactive' });
    mocks.delete.mockResolvedValue(undefined);
    mocks.projectUpdate.mockResolvedValue({});
    mocks.projectList.mockResolvedValue({ items: [], page: 1, page_size: 10, total_items: 0, total_pages: 0 });
  });

  it('renderiza listagem de inventariantes', async () => {
    renderWithProviders(<FieldAgentsPage />);
    expect(await screen.findByText('Ana Inventariante')).toBeInTheDocument();
    expect(screen.getByText('ana@gai.local')).toBeInTheDocument();
  });

  it('renderiza estado de loading', () => {
    mocks.list.mockReturnValue(new Promise(() => undefined));
    renderWithProviders(<FieldAgentsPage />);
    expect(screen.getByText('Carregando dados')).toBeInTheDocument();
  });

  it('renderiza estado vazio', async () => {
    mocks.list.mockResolvedValue(page([]));
    renderWithProviders(<FieldAgentsPage />);
    expect(await screen.findByText('Nenhum registro encontrado')).toBeInTheDocument();
  });

  it('renderiza estado de erro', async () => {
    mocks.list.mockRejectedValue(new Error('Falha de rede'));
    renderWithProviders(<FieldAgentsPage />);
    expect(await screen.findByText('Falha de rede')).toBeInTheDocument();
  });

  it('valida formulario de criacao', async () => {
    renderWithProviders(<FieldAgentsPage />);
    await userEvent.click(await screen.findByRole('button', { name: /novo inventariante/i }));
    await userEvent.click(screen.getByRole('button', { name: /salvar inventariante/i }));
    expect(await screen.findByText('Nome deve ter pelo menos 2 caracteres')).toBeInTheDocument();
    expect(screen.queryByLabelText(/organization/i)).not.toBeInTheDocument();
  });

  it('normaliza documento e telefone sem enviar organization_id', async () => {
    renderWithProviders(<FieldAgentsPage />);
    await userEvent.click(await screen.findByRole('button', { name: /novo inventariante/i }));
    await userEvent.type(screen.getByLabelText('Nome'), 'Maria Teste');
    await userEvent.type(screen.getByLabelText('CPF/CNPJ'), '52998224725');
    await userEvent.type(screen.getByLabelText('Telefone'), '+55 11 99999-8888');
    await userEvent.click(screen.getByRole('button', { name: /salvar inventariante/i }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Maria Teste', document: '52998224725', phone: '11999998888',
    })));
    expect(mocks.create.mock.calls[0][0]).not.toHaveProperty('organization_id');
  });

  it('mostra conflito de documento no campo e preserva o formulario', async () => {
    mocks.create.mockRejectedValueOnce(new ApiError(409, {
      code: 'CONFLICT', message: 'Documento duplicado', details: [{ field: 'document', message: 'CPF/CNPJ já cadastrado' }],
    }));
    renderWithProviders(<FieldAgentsPage />);
    await userEvent.click(await screen.findByRole('button', { name: /novo inventariante/i }));
    await userEvent.type(screen.getByLabelText('Nome'), 'Maria Teste');
    await userEvent.type(screen.getByLabelText('CPF/CNPJ'), '52998224725');
    await userEvent.click(screen.getByRole('button', { name: /salvar inventariante/i }));
    expect(await screen.findByText('CPF/CNPJ já cadastrado')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveValue('Maria Teste');
  });

  it('oculta botao de criar sem permissao', async () => {
    renderWithProviders(<FieldAgentsPage />, orgUser);
    await screen.findByText('Ana Inventariante');
    expect(screen.queryByRole('button', { name: /novo inventariante/i })).not.toBeInTheDocument();
  });

  it('desativa inventariante com confirmacao', async () => {
    renderWithProviders(<FieldAgentsPage />);
    await userEvent.click(await screen.findByLabelText('Desativar inventariante'));
    expect(screen.getByText('Desativar inventariante')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mocks.deactivate).toHaveBeenCalledWith(7));
  });

  it('exclui inventariante somente apos confirmacao', async () => {
    renderWithProviders(<FieldAgentsPage />);
    await userEvent.click(await screen.findByLabelText('Excluir inventariante'));
    expect(screen.getByText('Excluir inventariante')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mocks.delete).toHaveBeenCalledWith(7));
  });

  it('paginacao chama API com page/page_size', async () => {
    mocks.list.mockResolvedValue(page([agent], { total_items: 30, total_pages: 2 }));
    renderWithProviders(<FieldAgentsPage />);
    await userEvent.click(await screen.findByLabelText('Proxima pagina'));
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, page_size: 20 })));
  });

  it('renderiza inventariantes vinculados ao projeto', async () => {
    const assignment: ProjectFieldAgent = { id: 9, organization_id: 1, project_id: 10, field_agent_id: 7, role: 'Lider', status: 'active', start_date: null, end_date: null, notes: null, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' };
    mocks.projectList.mockResolvedValue({ items: [assignment], page: 1, page_size: 10, total_items: 1, total_pages: 1 });
    renderWithProviders(<ProjectFieldAgentsPanel projectId={10} />);
    expect(await screen.findByText('Inventariante #7')).toBeInTheDocument();
    expect(screen.getByText('Lider')).toBeInTheDocument();
  });

  it('trata conflito ao reativar vinculo e mantem o formulario aberto', async () => {
    const assignment: ProjectFieldAgent = { id: 9, organization_id: 1, project_id: 10, field_agent_id: 7, role: 'Lider', status: 'inactive', start_date: null, end_date: null, notes: null, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' };
    mocks.projectList.mockResolvedValue({ items: [assignment], page: 1, page_size: 10, total_items: 1, total_pages: 1 });
    mocks.projectUpdate.mockRejectedValueOnce(new ApiError(409, { code: 'CONFLICT', message: 'O inventariante já possui vínculo ativo com este projeto.' }));
    renderWithProviders(<ProjectFieldAgentsPanel projectId={10} />);
    await userEvent.click(await screen.findByLabelText('Editar vinculo'));
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'active');
    await userEvent.click(screen.getByRole('button', { name: 'Atualizar vínculo' }));
    expect(await screen.findByText('O inventariante já possui vínculo ativo com este projeto.')).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toHaveValue('active');
  });
});
