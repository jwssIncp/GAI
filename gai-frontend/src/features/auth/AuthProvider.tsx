import { useQueryClient } from '@tanstack/react-query';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { authApi } from '@/api/endpoints';
import { clearStoredSession, readStoredSession, writeStoredSession } from '@/api/session-storage';
import { AuthContext } from './AuthContext';
import type { CurrentUser, LoginRequest } from '@/types/api';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  const clear = useCallback(() => {
    clearStoredSession();
    setUser(null);
    setAccessToken(null);
    setExpiresAt(null);
    queryClient.clear();
  }, [queryClient]);

  const restore = useCallback(async () => {
    const stored = readStoredSession();
    if (!stored) {
      setBootstrapping(false);
      return;
    }
    if (new Date(stored.expiresAt).getTime() <= Date.now()) {
      clear();
      setBootstrapping(false);
      return;
    }
    setAccessToken(stored.accessToken);
    setExpiresAt(stored.expiresAt);
    try {
      const currentUser = await authApi.me();
      setUser(currentUser);
      writeStoredSession({ ...stored, user: currentUser });
    } catch {
      clear();
    } finally {
      setBootstrapping(false);
    }
  }, [clear]);

  useEffect(() => {
    void restore();
    const onExpired = () => clear();
    window.addEventListener('gai:session-expired', onExpired);
    return () => window.removeEventListener('gai:session-expired', onExpired);
  }, [clear, restore]);

  useEffect(() => {
    if (!expiresAt) return;
    const delay = Math.max(new Date(expiresAt).getTime() - Date.now(), 0);
    const timer = window.setTimeout(clear, delay);
    return () => window.clearTimeout(timer);
  }, [clear, expiresAt]);

  const login = useCallback(async (payload: LoginRequest) => {
    const response = await authApi.login(payload);
    writeStoredSession({ accessToken: response.access_token, expiresAt: response.expires_at, user: response.user });
    flushSync(() => {
      setAccessToken(response.access_token);
      setExpiresAt(response.expires_at);
      setUser(response.user);
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      if (accessToken) await authApi.logout();
    } finally {
      clear();
    }
  }, [accessToken, clear]);

  const value = useMemo(() => ({ user, accessToken, expiresAt, bootstrapping, login, logout, restore }), [user, accessToken, expiresAt, bootstrapping, login, logout, restore]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
