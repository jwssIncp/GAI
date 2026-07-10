import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import { ResourceListPage } from './ResourceListPage';
import type { CurrentUser } from '@/types/api';

type Row = { id: number; name: string };

const orgUser: CurrentUser = {
  id: 1,
  login: 'operador',
  email: 'operador@gai.local',
  status: 'ACTIVE',
  organization_id: 1,
  role_assignments: [{ assignment_id: 1, role_id: 3, role_key: 'ORG_USER', role_name: 'Operador', role_type: 'SYSTEM', organization_id: 1, assigned_at: '2026-01-01T00:00:00.000Z' }],
};

const orgAdmin: CurrentUser = {
  ...orgUser,
  role_assignments: [{ assignment_id: 2, role_id: 2, role_key: 'ORG_ADMIN', role_name: 'Admin', role_type: 'SYSTEM', organization_id: 1, assigned_at: '2026-01-01T00:00:00.000Z' }],
};

function renderPage(user: CurrentUser) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const auth: AuthState = { user, accessToken: 'token', expiresAt: '2099-01-01T00:00:00.000Z', bootstrapping: false, login: vi.fn(), logout: vi.fn(), restore: vi.fn() };
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <ResourceListPage<Row, { name: string }>
          title="Recursos"
          queryKey="qa-resources"
          createPermissions={['resources:create']}
          list={() => Promise.resolve({ items: [], page: 1, page_size: 20, total_items: 0, total_pages: 0 })}
          create={() => Promise.resolve({ id: 1, name: 'Novo' })}
          columns={[{ header: 'Nome', cell: (item) => item.name }]}
          getKey={(item) => item.id}
          form={() => <button type="submit">Salvar</button>}
        />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('ResourceListPage permissions', () => {
  it('oculta acao de criacao sem permissao visual', () => {
    renderPage(orgUser);
    expect(screen.queryByRole('button', { name: /novo/i })).not.toBeInTheDocument();
  });

  it('exibe acao de criacao para usuario com permissao efetiva', () => {
    renderPage(orgAdmin);
    expect(screen.getByRole('button', { name: /novo/i })).toBeInTheDocument();
  });
});
