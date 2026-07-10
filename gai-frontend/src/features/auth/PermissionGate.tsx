import { ReactNode } from 'react';
import { usePermissions } from './usePermissions';

export function PermissionGate({ permissions, children, fallback = null }: { permissions?: string[]; children: ReactNode; fallback?: ReactNode }) {
  const { canAccess } = usePermissions();
  return canAccess(permissions) ? <>{children}</> : <>{fallback}</>;
}
