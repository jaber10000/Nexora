'use client';
// Data layer for the admin dashboard: one request to GET /api/admin/dashboard?start=&end=
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errMsg } from '@/lib/api';

export type Kpis = {
  revenue: number; revenueChange: number | null;
  orders: number; ordersChange: number | null;
  avgOrderValue: number;
  customers: number; customersInRange: number;
  products: number; outOfStock: number; lowStock: number;
  todaySales: number; todayOrders: number;
  pending: number; cancelled: number;
};
export type DashboardData = {
  range: { start: string; end: string; days: number };
  kpis: Kpis;
  trend: { date: string; orders: number; revenue: number }[];
  monthly: { month: string; orders: number; revenue: number }[];
  statuses: { status: string; count: number }[];
  topProducts: { id: number; name: string; units: number; revenue: number }[];
  lowStock: { id: number; name: string; category: string; stock: number }[];
  recentOrders: { id: string; customer: string; total: number; status: string; payment: string; createdAt: string }[];
};

/* ---------- date range helpers (local calendar dates, YYYY-MM-DD) ---------- */
export type Range = { start: string; end: string };
export type PresetId = 'today' | '7d' | '30d' | '90d' | 'month' | 'custom';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

export const presets: { id: Exclude<PresetId, 'custom'>; label: string; range: () => Range }[] = [
  { id: 'today', label: 'Today', range: () => ({ start: iso(new Date()), end: iso(new Date()) }) },
  { id: '7d', label: '7 days', range: () => ({ start: daysAgo(6), end: iso(new Date()) }) },
  { id: '30d', label: '30 days', range: () => ({ start: daysAgo(29), end: iso(new Date()) }) },
  { id: '90d', label: '90 days', range: () => ({ start: daysAgo(89), end: iso(new Date()) }) },
  { id: 'month', label: 'This month', range: () => { const n = new Date(); return { start: iso(new Date(n.getFullYear(), n.getMonth(), 1)), end: iso(n) }; } },
];

export function useDashboard(range: Range) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const seq = useRef(0); // ignore responses from superseded requests (fast filter changes)

  const load = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    try {
      const d = await api<DashboardData>(`/api/admin/dashboard?start=${range.start}&end=${range.end}`);
      if (id !== seq.current) return;
      setData(d); setError('');
    } catch (e) {
      if (id !== seq.current) return;
      setError(errMsg(e));
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [range.start, range.end]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load };
}

/* ---------- formatting ---------- */
export const compactBDT = (n: number) =>
  n >= 10_000_000 ? `৳${(n / 10_000_000).toFixed(1)}Cr` : n >= 100_000 ? `৳${(n / 100_000).toFixed(1)}L` : n >= 1000 ? `৳${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : `৳${n}`;
export const shortDate = (isoDate: string) => new Date(isoDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
export const monthLabel = (ym: string) => new Date(ym + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'short' });
