import { createContext, useContext } from 'react';
import type { CurrentUser, LoginRequest } from '@/types/api';

export type AuthState = {
  user: CurrentUser | null;
  accessToken: string | null;
  expiresAt: string | null;
  bootstrapping: boolean;
  login: (payload: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  restore: () => Promise<void>;
};

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
