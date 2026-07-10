import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { readStoredSession } from '@/api/session-storage';
import { LoadingState } from '@/components/base/States';
import { useAuth } from '@/features/auth/AuthContext';
import { usePermissions } from '@/features/auth/usePermissions';

export function ProtectedRoute({ permissions }: { permissions?: string[] }) {
  const { user, bootstrapping, restore } = useAuth();
  const { canAccess } = usePermissions();
  const location = useLocation();
  const stored = !user ? readStoredSession() : null;
  const hasValidStoredSession = Boolean(stored && new Date(stored.expiresAt).getTime() > Date.now());

  useEffect(() => {
    if (!user && hasValidStoredSession) {
      void restore();
    }
  }, [hasValidStoredSession, restore, user]);

  if (bootstrapping) return <LoadingState label="Restaurando sessao" />;
  if (!user && hasValidStoredSession) return <LoadingState label="Validando sessao" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!canAccess(permissions)) return <Navigate to="/access-denied" replace />;
  return <Outlet />;
}
