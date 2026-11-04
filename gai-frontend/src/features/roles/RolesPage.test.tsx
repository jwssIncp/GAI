import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import type { AccessProfile, CurrentUser, RoleAssignment, User } from '@/types/api';
import { RolesPage } from './RolesPage';

const mocks = vi.hoisted(() => ({ profiles: vi.fn(), permissions: vi.fn(), list: vi.fn(), assignments: vi.fn(), assignRole: vi.fn(), revokeRole: vi.fn(), replaceRoles: vi.fn(), createRole: vi.fn(), updateRole: vi.fn(), deleteRole: vi.fn(), getRole: vi.fn(), organizations: vi.fn(), get: vi.fn(), restore: vi.fn() }));
vi.mock('@/api/endpoints', () => ({ rbacApi: mocks, usersApi: mocks, organizationsApi: { list: mocks.organizations } }));
const admin: CurrentUser = { id: 2, login: 'admin', email: 'admin@test.local', status: 'ACTIVE', organization_id: 1, role_assignments: [{ assignment_id: 1, role_id: 2, role_key: 'ORG_ADMIN', role_name: 'Admin', role_type: 'SYSTEM', assigned_at: '2026-01-01' }] };
const target: User = { ...admin, id: 3, login: 'Pessoa', email: 'pessoa@test.local', role_assignments: [], created_at: '2026-01-01', updated_at: '2026-01-01' };
const profiles: AccessProfile[] = [
  { id: 2, key: 'ORG_ADMIN', type: 'SYSTEM', organization_id: 1, name: 'Administrador da organização', description: 'Administra recursos e usuários.', user_count: 1, permission_count: 159, access_areas: ['users'], administrative: true, editable: false },
  { id: 4, key: 'ORG_USER', type: 'SYSTEM', organization_id: 1, name: 'Usuário da organização', description: 'Perfil básico da organização.', user_count: 0, permission_count: 0, access_areas: [], administrative: false, editable: false },
  { id: 3, key: null, type: 'ORGANIZATION', organization_id: 1, name: 'Operador', description: 'Perfil personalizado.', user_count: 1, permission_count: 1, access_areas: ['users'], administrative: false, editable: true },
];
let assigned: RoleAssignment[];
function setup(path = '/app/roles', user = admin) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ user, restore: mocks.restore } as unknown as AuthState}><QueryClientProvider client={client}><RolesPage /></QueryClientProvider></AuthContext.Provider></MemoryRouter>);
  return userEvent.setup();
}
beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset()); assigned = [];
  mocks.profiles.mockResolvedValue(profiles);
  mocks.list.mockResolvedValue({ data: [target], meta: { page: 1, page_size: 20, total: 1, total_pages: 1 } });
  mocks.assignments.mockImplementation(async () => assigned);
  mocks.assignRole.mockImplementation(async (_id, roleId) => { assigned = [{ assignment_id: 10, role_id: roleId, role_name: profiles.find((profile) => profile.id === roleId)!.name, role_type: 'SYSTEM', assigned_at: '2026-01-01' }]; });
  mocks.revokeRole.mockImplementation(async () => { assigned = []; });
  mocks.replaceRoles.mockImplementation(async () => { assigned = []; });
  mocks.permissions.mockResolvedValue([{ id: 1, key: 'users:read', resource: 'users', action: 'read', scope: 'ORGANIZATION', description: 'Consultar usuários' }, { id: 2, key: 'organizations:write', resource: 'organizations', action: 'write', scope: 'PLATFORM', description: 'Plataforma' }]);
  mocks.get.mockResolvedValue(target); mocks.restore.mockResolvedValue(undefined);
  mocks.organizations.mockResolvedValue({ items: [], total_pages: 0 });
});

describe('Perfis e acessos', () => {
  it('renders assignable cards without loading the technical catalog', async () => {
    setup();
    expect(await screen.findByRole('heading', { name: 'Operador' })).toBeInTheDocument();
    expect(screen.getByText(/Sem permissões associadas/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('PLATFORM_ADMIN')).not.toBeInTheDocument();
    expect(mocks.permissions).not.toHaveBeenCalled(); expect(mocks.profiles).toHaveBeenCalledWith(1);
  });

  it('requires acknowledgment before granting administrative privileges and refreshes assignments', async () => {
    const user = setup();
    const card = (await screen.findByRole('heading', { name: 'Administrador da organização' })).closest('article')!;
    await user.click(within(card).getByRole('button', { name: 'Atribuir perfil' }));
    await user.selectOptions(await screen.findByLabelText('Usuário'), '3');
    const confirm = await screen.findByRole('button', { name: 'Confirmar atribuição' });
    expect(confirm).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /Entendo que/ })); await user.click(confirm);
    await waitFor(() => expect(mocks.assignRole).toHaveBeenCalledWith(3, 2));
    expect(await screen.findByText('Perfis atualizados com sucesso.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revogar' })).toBeInTheDocument();
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ organization_id: 1, scope: 'ORGANIZATION' }));
  });

  it('shows assignment errors and supports cancellation by keyboard', async () => {
    mocks.assignRole.mockRejectedValueOnce(new Error('Atribuição recusada'));
    const user = setup();
    const card = (await screen.findByRole('heading', { name: 'Usuário da organização' })).closest('article')!;
    await user.click(within(card).getByRole('button', { name: 'Atribuir perfil' }));
    await user.selectOptions(await screen.findByLabelText('Usuário'), '3');
    await user.click(await screen.findByRole('button', { name: 'Confirmar atribuição' }));
    expect(await screen.findByText('Atribuição recusada')).toBeInTheDocument();
    await user.keyboard('{Escape}'); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('revokes through profile members with confirmation and cumulative-access explanation', async () => {
    assigned = [{ assignment_id: 10, role_id: 3, role_name: 'Operador', role_type: 'ORGANIZATION', assigned_at: '2026-01-01' }];
    const user = setup();
    const card = (await screen.findByRole('heading', { name: 'Operador' })).closest('article')!;
    await user.click(within(card).getByRole('button', { name: 'Ver detalhes' }));
    await user.click(await screen.findByRole('button', { name: 'Gerenciar perfis' }));
    await user.click(await screen.findByRole('button', { name: 'Revogar' }));
    expect(screen.getByText(/A remoção do último administrador ativo será bloqueada/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mocks.revokeRole).toHaveBeenCalledWith(3, 10));
    expect(await screen.findByText('Este usuário ainda não possui perfis efetivos.')).toBeInTheDocument();
  });

  it('replaces a complete set atomically from the users integration link', async () => {
    assigned = [{ assignment_id: 10, role_id: 3, role_name: 'Operador', role_type: 'ORGANIZATION', assigned_at: '2026-01-01' }];
    const user = setup('/app/roles?user_id=3&organization_id=1');
    await user.click(await screen.findByRole('button', { name: 'Substituir perfis' }));
    await user.click(screen.getByRole('checkbox', { name: 'Operador' }));
    await user.click(screen.getByRole('checkbox', { name: 'Usuário da organização' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar substituição' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mocks.replaceRoles).toHaveBeenCalledWith(3, [4]));
  });

  it('loads grouped organizational permissions only in the secondary editor', async () => {
    const user = setup();
    await user.click(await screen.findByRole('button', { name: 'Criar perfil personalizado' }));
    await user.type(await screen.findByLabelText('Nome do perfil'), 'Consulta');
    await user.click(screen.getByText('Usuários e administração'));
    await user.click(screen.getByRole('checkbox', { name: /Usuários · Consultar/ }));
    expect(screen.queryByText('Plataforma')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Salvar perfil' }));
    await waitFor(() => expect(mocks.createRole).toHaveBeenCalledWith(1, { name: 'Consulta', description: '', permission_ids: [1] }));
  });

  it('shows loading, empty and retryable error states', async () => {
    mocks.profiles.mockRejectedValueOnce(new Error('Falha ao consultar perfis')).mockResolvedValue([]);
    const user = setup();
    expect(screen.getByText('Carregando perfis disponíveis')).toBeInTheDocument();
    expect(await screen.findByText('Falha ao consultar perfis')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Nenhum perfil disponível')).toBeInTheDocument();
  });

  it('keeps platform administration separate and lets PLATFORM_ADMIN choose an organization', async () => {
    const platform: CurrentUser = { ...admin, organization_id: null, role_assignments: [{ ...admin.role_assignments[0], role_key: 'PLATFORM_ADMIN' }] };
    mocks.organizations.mockResolvedValue({ items: [{ id: 1, legal_name: 'Organização de teste' }], total_pages: 1 });
    const user = setup('/app/roles', platform);
    expect(await screen.findByLabelText('Organização ativa')).toHaveValue('');
    await screen.findByRole('option', { name: 'Organização de teste' });
    await user.selectOptions(screen.getByLabelText('Organização ativa'), '1');
    await waitFor(() => expect(mocks.profiles).toHaveBeenLastCalledWith(1));
  });
});
