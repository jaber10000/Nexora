'use client';
// Real auth against the FastAPI backend (JWT stored in localStorage).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, errMsg, getToken, setToken, AUTH_ERROR_EVENT, TOKEN_KEY_NAME } from '@/lib/api';

export const DEMO_EMAIL = 'demo@gmail.com';
export const DEMO_PASSWORD = 'jaberdemo';

type User = { id: number; name: string; email: string; phone: string; isAdmin: boolean; createdAt?: string };
type ApiUser = { id: number; name: string; email: string; phone?: string | null; is_admin: boolean; created_at?: string | null };
type TokenResponse = { access_token: string; user: ApiUser };

type Auth = {
  user: User | null;
  ready: boolean;
  // each returns an error message, or null on success
  login: (email: string, password: string) => Promise<string | null>;
  register: (name: string, email: string, password: string) => Promise<string | null>;
  logout: () => void;
  updateProfile: (name: string, phone: string) => Promise<string | null>;
  changePassword: (current: string, next: string) => Promise<string | null>;
};

const AuthContext = createContext<Auth | null>(null);
const toUser = (u: ApiUser): User => ({ id: u.id, name: u.name, email: u.email, phone: u.phone ?? '', isAdmin: u.is_admin, createdAt: u.created_at ?? undefined });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  // Ask the server who the token belongs to. The server is the source of truth for is_admin.
  const sync = useCallback(() => {
    if (!getToken()) { setUser(null); setReady(true); return; }
    api<ApiUser>('/api/auth/me')
      .then((u) => setUser(toUser(u)))
      .catch((e) => { if (e?.status === 401) { setToken(null); setUser(null); } }) // expired / invalid token
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    sync();
    const onAuthError = () => sync();                                        // an API call got 401/403
    const onStorage = (e: StorageEvent) => { if (e.key === TOKEN_KEY_NAME) sync(); }; // login/logout in another tab
    window.addEventListener(AUTH_ERROR_EVENT, onAuthError);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener(AUTH_ERROR_EVENT, onAuthError); window.removeEventListener('storage', onStorage); };
  }, [sync]);

  const finish = (r: TokenResponse) => { setToken(r.access_token); setUser(toUser(r.user)); return null; };

  const login = useCallback(async (email: string, password: string) => {
    try { return finish(await api<TokenResponse>('/api/auth/login', { method: 'POST', body: { email: email.trim(), password } })); }
    catch (e) { return errMsg(e); }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    try { return finish(await api<TokenResponse>('/api/auth/register', { method: 'POST', body: { name: name.trim(), email: email.trim(), password } })); }
    catch (e) { return errMsg(e); }
  }, []);

  const logout = useCallback(() => { setUser(null); setToken(null); }, []);

  const updateProfile = useCallback(async (name: string, phone: string) => {
    try { setUser(toUser(await api<ApiUser>('/api/auth/me', { method: 'PATCH', body: { name: name.trim(), phone: phone.trim() } }))); return null; }
    catch (e) { return errMsg(e); }
  }, []);

  const changePassword = useCallback(async (current: string, next: string) => {
    try { await api('/api/auth/change-password', { method: 'POST', body: { current_password: current, new_password: next } }); return null; }
    catch (e) { return errMsg(e); }
  }, []);

  const value = useMemo(() => ({ user, ready, login, register, logout, updateProfile, changePassword }),
    [user, ready, login, register, logout, updateProfile, changePassword]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
