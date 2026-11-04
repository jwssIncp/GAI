import { useQueryClient } from '@tanstack/react-query';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

  const sessionGeneration = useRef(0);

  const clear = useCallback(() => {
    sessionGeneration.current++;
    clearStoredSession();
    setUser(null);
    setAccessToken(null);
    setExpiresAt(null);
    setBootstrapping(false);
    queryClient.clear();
  }, [queryClient]);

  const restore = useCallback(async () => {
    const generation = sessionGeneration.current;
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
      if (generation !== sessionGeneration.current || readStoredSession()?.accessToken !== stored.accessToken) return;
      setUser(currentUser);
      writeStoredSession({ ...stored, user: currentUser });
    } catch {
      if (generation === sessionGeneration.current && readStoredSession()?.accessToken === stored.accessToken) clear();
    } finally {
      if (generation === sessionGeneration.current) setBootstrapping(false);
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

  useEffect(() => {
    if (!accessToken) return;
    // The API resolves grants on every request; refresh visible UI as well.
    let disposed = false;
    const refresh = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const currentUser = await authApi.me();
        const stored = readStoredSession();
        if (!disposed && stored?.accessToken === accessToken) {
          setUser(currentUser);
          writeStoredSession({ ...stored, user: currentUser });
        }
      } catch { /* HTTP 401 uses the existing session-expired event. */ }
    };
    const timer = window.setInterval(() => void refresh(), 60_000);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => { disposed = true; window.clearInterval(timer); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
  }, [accessToken]);

  const login = useCallback(
    async (payload: LoginRequest) => {
      const generation = ++sessionGeneration.current;
      const response = await authApi.login(payload);
      if (generation !== sessionGeneration.current)
        throw new Error("A sessão mudou durante o login. Entre novamente.");
      queryClient.clear();
      writeStoredSession({
        accessToken: response.access_token,
        expiresAt: response.expires_at,
        user: response.user,
      });
      flushSync(() => {
        setAccessToken(response.access_token);
        setExpiresAt(response.expires_at);
        setUser(response.user);
        setBootstrapping(false);
      });
      return response.user;
    },
    [queryClient],
  );

  const logout = useCallback(
    async (options?: { sessionRevoked?: boolean }) => {
      const generation = sessionGeneration.current;
      try {
        if (accessToken && !options?.sessionRevoked) await authApi.logout();
      } finally {
        if (generation === sessionGeneration.current) clear();
      }
    },
    [accessToken, clear],
  );

  const value = useMemo(() => ({ user, accessToken, expiresAt, bootstrapping, login, logout, restore }), [user, accessToken, expiresAt, bootstrapping, login, logout, restore]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
