import type { CurrentUser } from '@/types/api';

const KEY = 'gai.session.v1';

export type StoredSession = {
  accessToken: string;
  expiresAt: string;
  user: CurrentUser;
};

export function readStoredSession(): StoredSession | null {
  const raw = window.sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    window.sessionStorage.removeItem(KEY);
    return null;
  }
}

export function writeStoredSession(session: StoredSession) {
  window.sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  window.sessionStorage.removeItem(KEY);
}
