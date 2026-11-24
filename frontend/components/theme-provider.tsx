'use client';
// Applies the active theme to <html> as CSS variables — no reloads, no re-render of the page tree.
// Precedence: live preview (draft)  >  personal preference  >  published store theme.
//   • customers: personal preference lives in localStorage
//   • admins:    personal preference is saved in the database (and mirrored to localStorage)
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import {
  type Appearance, DEFAULT_APPEARANCE, LS_FX, LS_GLOBAL, LS_LOCAL, LS_LOCAL_PREV,
  applyTokens, prefersDark, readLS, sanitizeAppearance, tokensFor, writeLS,
} from '@/lib/theme';

type GlobalPayload = { appearance: Appearance; previous: Appearance | null; updated_at?: string | null; updated_by?: string | null };

type ThemeCtx = {
  ready: boolean;
  global: Appearance;
  previousGlobal: Appearance | null;
  publishedAt: string | null | undefined;
  mine: Appearance | null;
  previousMine: Appearance | null;
  effective: Appearance;
  preview: Appearance | null;
  setPreview: (a: Appearance | null) => void;
  setMine: (a: Appearance | null) => Promise<void>;
  publishGlobal: (a: Appearance) => Promise<void>;
  resetGlobal: () => Promise<void>;
  restoreGlobal: () => Promise<void>;
};

const Ctx = createContext<ThemeCtx | null>(null);

const toGlobal = (p: GlobalPayload) => ({
  appearance: sanitizeAppearance(p.appearance) ?? DEFAULT_APPEARANCE,
  previous: sanitizeAppearance(p.previous),
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user, ready: authReady } = useAuth();
  const [ready, setReady] = useState(false);
  const [global, setGlobal] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [previousGlobal, setPreviousGlobal] = useState<Appearance | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null | undefined>(null);
  const [mine, setMineState] = useState<Appearance | null>(null);
  const [previousMine, setPreviousMine] = useState<Appearance | null>(null);
  const [preview, setPreview] = useState<Appearance | null>(null);
  const [systemDark, setSystemDark] = useState(false);

  // First client render: read cached values (the boot script already painted them).
  useEffect(() => {
    const g = sanitizeAppearance(readLS(LS_GLOBAL)); if (g) setGlobal(g);
    setMineState(sanitizeAppearance(readLS(LS_LOCAL)));
    setPreviousMine(sanitizeAppearance(readLS(LS_LOCAL_PREV)));
    setSystemDark(prefersDark());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setSystemDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // Published store theme (public endpoint).
  useEffect(() => {
    let live = true;
    api<GlobalPayload>('/api/theme')
      .then((p) => {
        if (!live) return;
        const g = toGlobal(p);
        setGlobal(g.appearance); setPreviousGlobal(g.previous); setPublishedAt(p.updated_at);
        writeLS(LS_GLOBAL, g.appearance);
      })
      .catch(() => {})
      .finally(() => live && setReady(true));
    return () => { live = false; };
  }, []);

  // Admins: load the personal preference stored in the database.
  useEffect(() => {
    if (!authReady || !user?.isAdmin) return;
    let live = true;
    api<{ appearance: Appearance | null }>('/api/theme/me')
      .then((r) => {
        if (!live) return;
        const a = sanitizeAppearance(r.appearance);
        setMineState(a); writeLS(LS_LOCAL, a);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [authReady, user?.isAdmin, user?.id]);

  const effective = preview ?? mine ?? global;

  // Paint: set variables on <html>; cache the published/personal result for the boot script.
  useEffect(() => {
    applyTokens(tokensFor(effective, systemDark));
    if (preview) return;
    const sys = effective.selection === 'system';
    writeLS(LS_FX, { s: sys, t: tokensFor(effective, sys ? false : systemDark), d: sys ? tokensFor(effective, true) : undefined });
  }, [effective, preview, systemDark]);

  const setMine = useCallback(async (a: Appearance | null) => {
    if (user?.isAdmin) {
      if (a) await api('/api/theme/me', { method: 'PUT', body: { appearance: a } });
      else await api('/api/theme/me', { method: 'DELETE' });
    }
    if (mine) { setPreviousMine(mine); writeLS(LS_LOCAL_PREV, mine); }
    setMineState(a); writeLS(LS_LOCAL, a);
  }, [user?.isAdmin, mine]);

  const adopt = (p: GlobalPayload) => {
    const g = toGlobal(p);
    setGlobal(g.appearance); setPreviousGlobal(g.previous); setPublishedAt(p.updated_at);
    writeLS(LS_GLOBAL, g.appearance);
  };
  const publishGlobal = useCallback(async (a: Appearance) => { adopt(await api<GlobalPayload>('/api/theme', { method: 'PUT', body: { appearance: a } })); }, []);
  const resetGlobal = useCallback(async () => { adopt(await api<GlobalPayload>('/api/theme/reset', { method: 'POST' })); }, []);
  const restoreGlobal = useCallback(async () => { adopt(await api<GlobalPayload>('/api/theme/restore', { method: 'POST' })); }, []);

  const value = useMemo<ThemeCtx>(() => ({
    ready, global, previousGlobal, publishedAt, mine, previousMine, effective, preview,
    setPreview, setMine, publishGlobal, resetGlobal, restoreGlobal,
  }), [ready, global, previousGlobal, publishedAt, mine, previousMine, effective, preview, setMine, publishGlobal, resetGlobal, restoreGlobal]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTheme must be used inside <ThemeProvider>');
  return c;
}
