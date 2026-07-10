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
});
