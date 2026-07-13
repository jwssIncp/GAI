import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/http';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import type { CurrentUser, Project } from '@/types/api';
import { ProjectsPage } from './ProjectsPage';

const mocks = vi.hoisted(() => ({
  list: vi.fn(), create: vi.fn(), get: vi.fn(), update: vi.fn(),
  activate: vi.fn(), pause: vi.fn(), resume: vi.fn(), finish: vi.fn(), cancel: vi.fn(), archive: vi.fn(),
  companiesList: vi.fn(), companyGet: vi.fn(), organizationsList: vi.fn(), organizationGet: vi.fn(),
}));

vi.mock('@/api/endpoints', () => ({
  projectsApi: {
    list: mocks.list, create: mocks.create, get: mocks.get, update: mocks.update,
    activate: mocks.activate, pause: mocks.pause, resume: mocks.resume, finish: mocks.finish, cancel: mocks.cancel, archive: mocks.archive,
  },
  companiesApi: { list: mocks.companiesList, get: mocks.companyGet },
  organizationsApi: { list: mocks.organizationsList, get: mocks.organizationGet },
  projectUnitsApi: { list: vi.fn(), assign: vi.fn(), remove: vi.fn() },
}));

const project: Project = {
  id: 10, organization_id: 1, company_id: 3, name: 'Projeto Alpha', description: null, status: 'draft',
  start_date: null, end_date: null, finished_at: null, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
};

const permissions = ['projects:read', 'projects:create', 'projects:update', 'companies:read'].map((key) => ({ key, scope: 'ORGANIZATION' as const }));
const user: CurrentUser = {
  id: 1, login: 'operador', email: 'operador@gai.local', status: 'ACTIVE', organization_id: 1, permissions,
  role_assignments: [{ assignment_id: 1, role_id: 4, role_name: 'Projetos', role_type: 'ORGANIZATION', organization_id: 1, assigned_at: '2026-01-01' }],
};

function renderPage(initialEntry = '/app/projects', sessionUser: CurrentUser = user) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const auth: AuthState = { user: sessionUser, accessToken: 'token', expiresAt: '2099-01-01T00:00:00.000Z', bootstrapping: false, login: vi.fn(), logout: vi.fn(), restore: vi.fn() };
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes><Route path="/app/projects" element={<ProjectsPage />} /></Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('ProjectsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue({ items: [], page: 1, page_size: 20, total_items: 0, total_pages: 0 });
    mocks.companiesList.mockResolvedValue({ items: [{ id: 3, organization_id: 1, name: 'Empresa Alpha', status: 'active' }], page: 1, page_size: 20, total_items: 1, total_pages: 1 });
    mocks.companyGet.mockResolvedValue({ id: 3, organization_id: 1, name: 'Empresa Alpha', status: 'active' });
    mocks.organizationsList.mockResolvedValue({ items: [], page: 1, page_size: 20, total_items: 0, total_pages: 0 });
    mocks.organizationGet.mockResolvedValue({ id: 1, legal_name: 'Organizacao Alpha', status: 'ACTIVE' });
    mocks.create.mockResolvedValue(project);
    mocks.get.mockResolvedValue(project);
    mocks.update.mockResolvedValue({ ...project, name: 'Projeto Atualizado' });
  });

  it('cria no tenant autenticado e normaliza campos opcionais', async () => {
    renderPage('/app/projects?new=1');
    await screen.findByRole('option', { name: 'Empresa Alpha' });
    await userEvent.selectOptions(screen.getAllByLabelText('Empresa')[1], '3');
    await userEvent.type(screen.getByLabelText('Nome'), '  Projeto Novo  ');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar projeto' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({ organization_id: 1, company_id: 3, name: 'Projeto Novo' }));
    expect(screen.queryByLabelText('Organizacao')).not.toBeInTheDocument();
  });

  it('edita apenas campos mutaveis', async () => {
    mocks.get.mockResolvedValue({ ...project, description: 'Descricao anterior', start_date: '2026-01-10', end_date: '2026-02-10' });
    renderPage('/app/projects?edit=10');
    const name = await screen.findByLabelText('Nome');
    await userEvent.clear(name);
    await userEvent.type(name, 'Projeto Atualizado');
    await userEvent.clear(screen.getByLabelText('Descricao'));
    await userEvent.clear(screen.getByLabelText('Inicio'));
    await userEvent.clear(screen.getByLabelText('Fim'));
    await userEvent.click(screen.getByRole('button', { name: 'Atualizar projeto' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    const payload = mocks.update.mock.calls[0][1];
    expect(payload).toMatchObject({ name: 'Projeto Atualizado', description: null, start_date: null, end_date: null });
    expect(payload).not.toHaveProperty('organization_id');
    expect(payload).not.toHaveProperty('company_id');
    expect(payload).not.toHaveProperty('status');
  });

  it('envia filtros da URL e mantem o tenant do usuario', async () => {
    renderPage('/app/projects?page=2&search=Alpha&status=active&company_id=3');
    await waitFor(() => expect(mocks.list).toHaveBeenCalledWith({ page: 2, page_size: 20, search: 'Alpha', status: 'active', organization_id: 1, company_id: 3 }));
  });

  it('explica bloqueio quando falta companies:read', async () => {
    renderPage('/app/projects?new=1', { ...user, permissions: permissions.filter((permission) => permission.key !== 'companies:read') });
    expect(await screen.findByText(/nao possui `companies:read`/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar projeto' })).toBeDisabled();
    expect(mocks.companiesList).not.toHaveBeenCalled();
  });

  it('mapeia erro 422 do backend no campo sem perder o formulario', async () => {
    mocks.create.mockRejectedValue(new ApiError(422, {
      code: 'VALIDATION_ERROR',
      message: 'Dados invalidos.',
      details: [{ field: 'name', message: 'Nome ja utilizado neste contexto.' }],
    }));
    renderPage('/app/projects?new=1');
    await screen.findByRole('option', { name: 'Empresa Alpha' });
    await userEvent.selectOptions(screen.getAllByLabelText('Empresa')[1], '3');
    await userEvent.type(screen.getByLabelText('Nome'), 'Projeto Repetido');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar projeto' }));
    expect(await screen.findByText('Nome ja utilizado neste contexto.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveValue('Projeto Repetido');
  });

  it('mantem projeto terminal somente para consulta inclusive por URL direta', async () => {
    const finished = { ...project, status: 'finished' as const };
    mocks.list.mockResolvedValue({ items: [finished], page: 1, page_size: 20, total_items: 1, total_pages: 1 });
    mocks.get.mockResolvedValue(finished);
    renderPage('/app/projects?edit=10');
    expect(await screen.findByText(/somente para consulta/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
  });
});
