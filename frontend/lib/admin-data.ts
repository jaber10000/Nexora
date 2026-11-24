'use client';
// Data layer for the storefront + admin modules (categories, orders, customers, coupons,
// settings, stats). Everything is loaded from / saved to the FastAPI backend.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { paymentMethods, type Order } from '@/lib/orders';
import { refreshCatalog } from '@/lib/catalog';

/* ---------- tiny shared-cache hook: components using the same key stay in sync ---------- */
type Entry<T> = { value: T; loaded: boolean; error: string; subs: Set<() => void>; inflight?: Promise<void> };
const entries = new Map<string, Entry<unknown>>();
function entry<T>(key: string, initial: T): Entry<T> {
  if (!entries.has(key)) entries.set(key, { value: initial, loaded: false, error: '', subs: new Set() });
  return entries.get(key) as Entry<T>;
}
function useRemote<T>(key: string, path: string, initial: T, fresh = false) {
  const e = entry<T>(key, initial);
  const [, force] = useState(0);
  const load = useCallback(() => {
    e.inflight ??= api<T>(path)
      .then((v) => { e.value = v; e.error = ''; })
      .catch((err) => { e.error = err instanceof Error ? err.message : 'Could not load data.'; })
      .finally(() => { e.loaded = true; e.inflight = undefined; e.subs.forEach((f) => f()); });
    return e.inflight;
  }, [e, path]);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    e.subs.add(f);
    if (!e.loaded || fresh) load();
    return () => { e.subs.delete(f); };
  }, [e, load, fresh]);
  const set = useCallback((v: T) => { e.value = v; e.subs.forEach((f) => f()); }, [e]);
  return { value: e.value, ready: e.loaded, error: e.error, set, reload: () => { e.loaded = false; return load(); } };
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

/* ---------------- Categories ---------------- */
export type Category = { id: number; name: string; description: string };
export function useCategories() {
  const { value: items, set, ready } = useRemote<Category[]>('categories', '/api/categories', []);
  const add = async (name: string, description: string) => set([...items, await api<Category>('/api/categories', { method: 'POST', body: { name, description } })]);
  const update = async (id: number, name: string, description: string) => {
    const c = await api<Category>(`/api/categories/${id}`, { method: 'PUT', body: { name, description } });
    set(items.map((x) => (x.id === id ? c : x)));
    refreshCatalog(); // products follow a renamed category
  };
  const remove = async (id: number) => { await api(`/api/categories/${id}`, { method: 'DELETE' }); set(items.filter((x) => x.id !== id)); };
  return { items, ready, names: items.map((c) => c.name), add, update, remove };
}

/* ---------------- Orders ---------------- */
export const orderStatuses = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'] as const;
export type OrderStatus = (typeof orderStatuses)[number];
export type AdminOrder = {
  id: string; date: string; customer: string; phone: string; email: string; address: string;
  payment: string; items: { name: string; qty: number; price: number }[]; delivery: number; total: number; status: OrderStatus;
  discount?: number; coupon?: string;
  full: Order; // complete API record (timeline, refund, payment status, tracking …)
};
export type EmailLogRow = { id: number; kind: string; to: string; subject: string; status: 'sent' | 'logged' | 'failed'; error?: string | null; at: string };
export type StatusExtra = { note?: string; courier?: string; trackingNumber?: string };

const toAdminOrder = (o: Order): AdminOrder => ({
  id: o.id, date: o.createdAt, customer: o.address.name, phone: o.address.phone, email: o.email || '—',
  address: [o.address.address, o.address.area, o.address.district].filter(Boolean).join(', '),
  payment: paymentMethods.find((p) => p.id === o.payment)?.label ?? o.payment,
  items: o.lines.map((l) => ({ name: l.name, qty: l.quantity, price: l.price })),
  delivery: o.delivery, total: o.total, status: (o.status ?? 'Pending') as OrderStatus,
  discount: o.discount, coupon: o.coupon ?? undefined, full: o,
});

export function useAdminOrders() {
  const { value: raw, set, ready, reload } = useRemote<Order[]>('admin-orders', '/api/admin/orders', [], true);
  const orders = useMemo(() => raw.map(toAdminOrder), [raw]);
  const replace = useCallback((saved: Order) => set(raw.map((o) => (o.id === saved.id ? saved : o))), [raw, set]);
  const base = (id: string) => `/api/admin/orders/${encodeURIComponent(id)}`;

  const setStatus = useCallback(async (id: string, status: OrderStatus, extra: StatusExtra = {}) => {
    const prev = raw;
    set(raw.map((o) => (o.id === id ? { ...o, status } : o))); // optimistic
    try {
      const saved = await api<Order>(`${base(id)}/status`, { method: 'PATCH', body: { status, ...extra } });
      set(raw.map((o) => (o.id === id ? saved : o)));
      refreshCatalog(); // cancelling / un-cancelling changes stock
    } catch (e) { set(prev); throw e; }
  }, [raw, set]);

  const setPaid = useCallback(async (id: string, paid: boolean) => replace(await api<Order>(`${base(id)}/payment`, { method: 'PATCH', body: { paid } })), [replace]);
  const refund = useCallback(async (id: string, body: { amount: number; method: string; note?: string; restock?: boolean }) => {
    replace(await api<Order>(`${base(id)}/refund`, { method: 'POST', body }));
    if (body.restock) refreshCatalog();
  }, [replace]);
  const rejectRefund = useCallback(async (id: string, note: string) => replace(await api<Order>(`${base(id)}/refund/reject`, { method: 'POST', body: { note } })), [replace]);
  const emailInvoice = useCallback((id: string) => api<{ queued: boolean; to: string }>(`${base(id)}/email-invoice`, { method: 'POST' }), []);
  const emails = useCallback((id: string) => api<EmailLogRow[]>(`${base(id)}/emails`), []);
  return { orders, setStatus, setPaid, refund, rejectRefund, emailInvoice, emails, ready, reload };
}

/* ---------------- Customers (derived from real orders, grouped by phone) ---------------- */
export type Customer = {
  id: string; name: string; phone: string; email: string; district: string; joined: string;
  orders: AdminOrder[]; count: number; spent: number; last?: string;
};
export function useCustomers(orders: AdminOrder[]): Customer[] {
  return useMemo(() => {
    const byPhone = new Map<string, AdminOrder[]>();
    orders.forEach((o) => byPhone.set(o.phone, [...(byPhone.get(o.phone) ?? []), o]));
    return [...byPhone.entries()].map(([phone, mine]) => {
      const newest = mine[0]; // API returns newest first
      const paid = mine.filter((o) => o.status !== 'Cancelled');
      return {
        id: phone, name: newest.customer, phone, email: newest.email,
        district: newest.address.split(',').pop()?.trim() || '—',
        joined: mine[mine.length - 1].date, orders: mine, count: mine.length,
        spent: paid.reduce((n, o) => n + o.total, 0), last: newest.date,
      };
    });
  }, [orders]);
}

/* ---------------- Coupons ---------------- */
export type Coupon = { id: number; code: string; type: 'percent' | 'fixed'; value: number; minOrder: number; limit: number; used: number; expires: string; active: boolean };
export function useCoupons() {
  const { value: coupons, set, ready } = useRemote<Coupon[]>('coupons', '/api/coupons', [], true);
  const save = async (c: Omit<Coupon, 'id' | 'used'> & { id?: number }) => {
    if (c.id) { const s = await api<Coupon>(`/api/coupons/${c.id}`, { method: 'PUT', body: c }); set(coupons.map((x) => (x.id === s.id ? s : x))); }
    else set([await api<Coupon>('/api/coupons', { method: 'POST', body: c }), ...coupons]);
  };
  const remove = async (id: number) => { await api(`/api/coupons/${id}`, { method: 'DELETE' }); set(coupons.filter((x) => x.id !== id)); };
  return { coupons, ready, save, remove };
}

/* ---------------- Settings (public read, admin write) ---------------- */
export type Settings = { storeName: string; tagline: string; logo: string; email: string; phone: string; whatsapp: string; address: string; facebook: string; instagram: string; hours: string };
export const seedSettings: Settings = {
  storeName: 'NEXORA', tagline: 'Considered products for modern living.', logo: '', email: 'hello@nexora.com',
  phone: '+880 1700 000000', whatsapp: '+880 1700 000000', address: 'Road 11, Banani, Dhaka 1213, Bangladesh',
  facebook: 'facebook.com/nexora', instagram: 'instagram.com/nexora', hours: 'Sat – Thu, 10:00 AM – 8:00 PM',
};
// Same tuple shape as before: [settings, save, reset]. save/reset return a promise (rejects on failure).
export function useSettings() {
  const { value, set } = useRemote<Settings>('settings', '/api/settings', seedSettings);
  const save = useCallback(async (next: Settings) => { set(await api<Settings>('/api/settings', { method: 'PUT', body: next })); }, [set]);
  const reset = useCallback(() => save(seedSettings), [save]);
  return [value, save, reset] as const;
}

/* ---------------- Dashboard / analytics ---------------- */
export type Stats = {
  sales: number; orders: number; customers: number;
  daily: { day: string; orders: number; sales: number }[];
  monthly: [string, number][];
  sold: Record<string, number>;
};
const EMPTY_STATS: Stats = { sales: 0, orders: 0, customers: 0, daily: [], monthly: [], sold: {} };
// Always returns a complete Stats object (missing / malformed fields -> safe defaults) so charts never see undefined.
export function useStats() {
  const r = useRemote<Stats>('stats', '/api/admin/stats', EMPTY_STATS, true);
  const v = (r.value ?? EMPTY_STATS) as Partial<Stats>;
  const num = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? n : 0);
  const value: Stats = {
    sales: num(v.sales), orders: num(v.orders), customers: num(v.customers),
    daily: Array.isArray(v.daily) ? v.daily.map((d) => ({ day: String(d?.day ?? ''), orders: num(d?.orders), sales: num(d?.sales) })) : [],
    monthly: Array.isArray(v.monthly) ? v.monthly.map(([k, n]) => [String(k), num(n)] as [string, number]) : [],
    sold: v.sold && typeof v.sold === 'object' ? v.sold : {},
  };
  return { ...r, value };
}
