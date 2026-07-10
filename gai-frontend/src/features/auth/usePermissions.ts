import { useAuth } from './AuthContext';
import { canAccess, getSystemRoles, hasPermission, isPlatformAdmin } from './permissions';

export function usePermissions() {
  const { user } = useAuth();
  return {
    roles: getSystemRoles(user),
    isPlatformAdmin: isPlatformAdmin(user),
    hasPermission: (permission: string) => hasPermission(user, permission),
    canAccess: (permissions?: string[]) => canAccess(user, permissions),
  };
}
