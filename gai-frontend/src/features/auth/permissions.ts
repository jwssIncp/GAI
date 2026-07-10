import type { CurrentUser, SystemRoleKey } from '@/types/api';

export function getSystemRoles(user: CurrentUser | null): SystemRoleKey[] {
  return (user?.role_assignments ?? [])
    .filter((assignment) => assignment.role_type === 'SYSTEM' && assignment.role_key)
    .map((assignment) => assignment.role_key as SystemRoleKey);
}

export function isPlatformAdmin(user: CurrentUser | null) {
  return getSystemRoles(user).includes('PLATFORM_ADMIN');
}

export function hasPermission(user: CurrentUser | null, permission: string) {
  if (!user) return false;
  if (isPlatformAdmin(user)) return true;
  const roleKeys = getSystemRoles(user);
  if (roleKeys.includes('ORG_ADMIN')) {
    return !permission.startsWith('organizations:');
  }
  return false;
}

export function canAccess(user: CurrentUser | null, permissions?: string[]) {
  if (!permissions?.length) return Boolean(user);
  return permissions.some((permission) => hasPermission(user, permission));
}
