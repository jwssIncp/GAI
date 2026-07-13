import { describe, expect, it } from 'vitest';
import { canAccess, hasPermission, isPlatformAdmin } from './permissions';
import type { CurrentUser } from '@/types/api';

const baseUser: CurrentUser = {
  id: 1,
  login: 'admin',
  email: 'admin@gai.local',
  status: 'ACTIVE',
  organization_id: null,
  role_assignments: [],
};

describe('permissions', () => {
  it('libera plataforma para qualquer permissao visual', () => {
    const user: CurrentUser = { ...baseUser, role_assignments: [{ assignment_id: 1, role_id: 1, role_key: 'PLATFORM_ADMIN', role_name: 'Platform', role_type: 'SYSTEM', organization_id: null, assigned_at: '2026-01-01' }] };
    expect(isPlatformAdmin(user)).toBe(true);
    expect(hasPermission(user, 'companies:read')).toBe(true);
  });

  it('mapeia ORG_ADMIN para users e org roles', () => {
    const user: CurrentUser = { ...baseUser, role_assignments: [{ assignment_id: 1, role_id: 2, role_key: 'ORG_ADMIN', role_name: 'Org Admin', role_type: 'SYSTEM', organization_id: 1, assigned_at: '2026-01-01' }] };
    expect(canAccess(user, ['users:read'])).toBe(true);
    expect(canAccess(user, ['companies:read'])).toBe(true);
    expect(canAccess(user, ['organizations:read'])).toBe(false);
  });

  it('usa permissoes efetivas quando o backend as retorna', () => {
    const user: CurrentUser = {
      ...baseUser,
      organization_id: 1,
      permissions: [{ key: 'projects:read', scope: 'ORGANIZATION' }],
      role_assignments: [{ assignment_id: 1, role_id: 7, role_name: 'Leitor de projetos', role_type: 'ORGANIZATION', organization_id: 1, assigned_at: '2026-01-01' }],
    };
    expect(hasPermission(user, 'projects:read')).toBe(true);
    expect(hasPermission(user, 'projects:create')).toBe(false);
  });

  it('nao aplica fallback administrativo quando permissions vem vazio', () => {
    const user: CurrentUser = {
      ...baseUser,
      permissions: [],
      role_assignments: [{ assignment_id: 1, role_id: 1, role_key: 'PLATFORM_ADMIN', role_name: 'Platform', role_type: 'SYSTEM', organization_id: null, assigned_at: '2026-01-01' }],
    };
    expect(hasPermission(user, 'projects:read')).toBe(false);
  });

  it('exige todas as permissoes declaradas', () => {
    const user: CurrentUser = { ...baseUser, permissions: [{ key: 'payments:read', scope: 'ORGANIZATION' }] };
    expect(canAccess(user, ['payments:read', 'expenses:read'])).toBe(false);
  });
});
