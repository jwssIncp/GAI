import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import type { CompanyUnit, CurrentUser, Project, ProjectUnit } from '@/types/api';
import { ProjectUnitsPanel } from './ProjectUnitsPanel';

const mocks = vi.hoisted(() => ({
  listLinks: vi.fn(), assign: vi.fn(), remove: vi.fn(), listUnits: vi.fn(), toast: vi.fn(),
}));

vi.mock('@/api/endpoints', () => ({
  projectUnitsApi: { list: mocks.listLinks, assign: mocks.assign, remove: mocks.remove },
  companyUnitsApi: { list: mocks.listUnits, get: vi.fn() },
  companiesApi: { list: vi.fn(), get: vi.fn() },
  organizationsApi: { list: vi.fn(), get: vi.fn() },
  projectsApi: {},
}));

const linkedUnit: CompanyUnit = {
  id: 7,
  organization_id: 1,
  company_id: 3,
  name: 'Matriz',
  code: 'MTZ',
  status: 'active',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};
const availableUnit: CompanyUnit = { ...linkedUnit, id: 8, name: 'Filial Norte', code: 'NRT' };
const link: ProjectUnit = {
  id: 91,
  organization_id: 1,
  project_id: 10,
  company_unit_id: linkedUnit.id,
  company_unit: linkedUnit,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};
const project: Project = {
  id: 10,
  organization_id: 1,
  company_id: 3,
  name: 'Projeto Alpha',
  status: 'active',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};
const permissionKeys = ['project-units:read', 'project-units:assign', 'project-units:remove', 'company-units:read'];

function renderPanel(status: Project['status'] = 'active') {
  const user: CurrentUser = {
    id: 1,
    login: 'operador',
    email: 'operador@gai.local',
    status: 'ACTIVE',
    organization_id: 1,
    role_assignments: [],
    permissions: permissionKeys.map((key) => ({ key, scope: 'ORGANIZATION' })),
  };
  const auth: AuthState = {
    user,
    accessToken: 'token',
    expiresAt: '2099-01-01T00:00:00.000Z',
    bootstrapping: false,
    login: vi.fn(),
    logout: vi.fn(),
    restore: vi.fn(),
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <ProjectUnitsPanel project={{ ...project, status }} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('ProjectUnitsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listLinks.mockResolvedValue({ items: [link] });
    mocks.listUnits.mockResolvedValue({ items: [linkedUnit, availableUnit], page: 1, page_size: 20, total_items: 2, total_pages: 1 });
    mocks.assign.mockResolvedValue({ ...link, id: 92, company_unit_id: availableUnit.id, company_unit: availableUnit });
    mocks.remove.mockResolvedValue(link);
  });

  it('lista, vincula e remove unidades pelos endpoints reais', async () => {
    renderPanel();
    expect(await screen.findByText('Matriz')).toBeInTheDocument();
    expect(screen.getByText('Codigo: MTZ')).toBeInTheDocument();
    await screen.findByRole('option', { name: 'Filial Norte (NRT)' });
    expect(screen.queryByRole('option', { name: 'Matriz (MTZ)' })).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Unidade'), String(availableUnit.id));
    await userEvent.click(screen.getByRole('button', { name: 'Vincular unidade' }));
    await waitFor(() => expect(mocks.assign).toHaveBeenCalledWith(project.id, availableUnit.id));

    await userEvent.click(screen.getByRole('button', { name: 'Remover Matriz' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(project.id, linkedUnit.id));
  });

  it('mantem somente consulta em status terminal', async () => {
    renderPanel('finished');
    expect(await screen.findByText('Matriz')).toBeInTheDocument();
    expect(screen.getByText(/somente para consulta/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Unidade')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover Matriz' })).not.toBeInTheDocument();
    expect(mocks.listUnits).not.toHaveBeenCalled();
  });
});
