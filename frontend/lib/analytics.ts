'use client';
// Data layer for the analytics tabs of the admin dashboard: GET /api/admin/analytics?start=&end=
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errMsg } from '@/lib/api';
import type { Range } from '@/lib/dashboard';

export type Day = { date: string; orders: number; revenue: number };
export type ProductStat = { id: number | null; name: string; category: string; units: number; revenue: number };
export type StockRow = { id: number; name: string; category: string; stock: number };
export type CouponRow = { code: string; type: string; value: number; used: number; limit: number; active: boolean; expires: string; usageRate: number | null };

export type AnalyticsData = {
  range: { start: string; end: string; days: number };
  revenue: {
    total: number; orders: number; daily: Day[];
    monthly: { month: string; orders: number; revenue: number }[];
    yearly: { year: string; orders: number; revenue: number }[];
  };
  sales: {
    bestSelling: ProductStat[];
    topCategories: { category: string; units: number; revenue: number }[];
    performance: ProductStat[];
    productRevenue: ProductStat[];
  };
  orders: {
    statuses: { status: string; count: number }[];
    perDay: Day[];
    divisions: { division: string; orders: number; revenue: number }[];
    districts: { district: string; orders: number; revenue: number }[];
  };
  customers: {
    newCustomers: number; returningCustomers: number; totalCustomers: number;
    monthly: { month: string; new: number; returning: number; total: number }[];
    topSpenders: { name: string; phone: string; orders: number; spent: number }[];
  };
  inventory: {
    lowThreshold: number; outOfStockCount: number; lowStockCount: number; total: number;
    lowStock: StockRow[]; outOfStock: StockRow[]; levels: StockRow[];
  };
  coupons: {
    list: CouponRow[];
    topCoupons: { code: string; uses: number; discount: number; revenue: number }[];
    ordersWithCoupon: number; orders: number; usageRate: number;
    discountGiven: number; revenue: number; gross: number; discountPct: number;
    monthly: { month: string; discount: number; revenue: number }[];
  };
};

/** Loads analytics only while `enabled` (i.e. when an analytics tab is open); refetches when the date range changes. */
export function useAnalytics(range: Range, enabled: boolean) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const seq = useRef(0);
  const loadedFor = useRef('');

  const load = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    try {
      const d = await api<AnalyticsData>(`/api/admin/analytics?start=${range.start}&end=${range.end}`);
      if (id !== seq.current) return;
      setData(d); setError(''); loadedFor.current = `${range.start}|${range.end}`;
    } catch (e) {
      if (id !== seq.current) return;
      setError(errMsg(e));
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [range.start, range.end]);

  useEffect(() => {
    if (enabled && loadedFor.current !== `${range.start}|${range.end}`) load();
  }, [enabled, load, range.start, range.end]);

  return { data, loading, error, reload: load };
}

export const yearLabel = (y: string) => y;
export const trunc = (s: string, n = 16) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
