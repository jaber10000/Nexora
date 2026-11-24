'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

export type NotifKind = 'order' | 'stock' | 'payment' | 'customer';
export type Notif = { id: number; kind: NotifKind; severity: 'info' | 'success' | 'warning' | 'danger'; title: string; body: string; link: string; read: boolean; createdAt: string | null };
export type Unread = { total: number } & Record<NotifKind, number>;
const EMPTY: Unread = { total: 0, order: 0, stock: 0, payment: 0, customer: 0 };
const REFRESH = 'nexora:notif-refresh';

export const KIND_LABEL: Record<NotifKind | 'all', string> = { all: 'All', order: 'Orders', stock: 'Low stock', payment: 'Payments', customer: 'Customers' };

export function timeAgo(iso: string | null) {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Admin notifications with light polling. Every mutation refreshes all mounted instances (bell, sidebar, page). */
export function useNotifications({ kind = 'all', limit = 60, poll = 30000 }: { kind?: NotifKind | 'all'; limit?: number; poll?: number } = {}) {
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState<Unread>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ items: Notif[]; unread: Unread }>(`/api/admin/notifications?limit=${limit}${kind !== 'all' ? `&kind=${kind}` : ''}`);
      if (!alive.current) return;
      setItems(r.items); setUnread(r.unread); setError('');
    } catch (e) { if (alive.current) setError((e as Error).message); }
    finally { if (alive.current) setLoading(false); }
  }, [kind, limit]);

  useEffect(() => {
    alive.current = true; refresh();
    const t = poll ? window.setInterval(refresh, poll) : 0;
    const on = () => refresh();
    window.addEventListener(REFRESH, on);
    return () => { alive.current = false; if (t) clearInterval(t); window.removeEventListener(REFRESH, on); };
  }, [refresh, poll]);

  const mutate = useCallback(async (path: string, method: string, body?: unknown) => {
    await api(path, { method, body });
    window.dispatchEvent(new Event(REFRESH));
  }, []);

  return {
    items, unread, loading, error, refresh,
    markRead: (ids: number[]) => mutate('/api/admin/notifications/read', 'POST', { ids }),
    markAll: (k?: NotifKind) => mutate('/api/admin/notifications/read', 'POST', k ? { kind: k } : { all: true }),
    dismiss: (id: number) => mutate(`/api/admin/notifications/${id}`, 'DELETE'),
    clearRead: () => mutate('/api/admin/notifications', 'DELETE'),
  };
}
