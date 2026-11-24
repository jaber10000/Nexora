'use client';
import { useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatBDT } from '@/lib/products';
import { compactBDT, monthLabel, shortDate, type DashboardData } from '@/lib/dashboard';

export const ORANGE = 'var(--chart-1)', INK = 'var(--chart-ink)', GRID = 'var(--chart-grid)', MUTED = 'var(--text-soft)';
export const STATUS_COLORS: Record<string, string> = {
  Pending: 'var(--chart-5)', Confirmed: 'var(--chart-2)', Processing: 'var(--chart-3)', Shipped: 'var(--chart-4)', Delivered: 'var(--success-fill)', Cancelled: 'var(--error-fill)',
};
export const axis = { fontSize: 12, fill: MUTED } as const;

type TipProps = { active?: boolean; payload?: { value?: number; payload?: Record<string, unknown> }[]; label?: string };
export function Tip({ active, payload, label, rows }: TipProps & { rows: (p: Record<string, unknown>) => [string, string][] }) {
  if (!active || !payload?.length || !payload[0].payload) return null;
  return (
    <div className="chart-tip">
      <b>{label}</b>
      {rows(payload[0].payload).map(([k, v]) => <div key={k}><span>{k}</span><em>{v}</em></div>)}
    </div>
  );
}
export const Empty = ({ text }: { text: string }) => <div className="chart-empty">{text}</div>;

/* ---------- Revenue trend (area) — daily for the selected range, or last 12 months ---------- */
export function RevenueTrend({ data }: { data: DashboardData }) {
  const [view, setView] = useState<'daily' | 'monthly'>('daily');
  const rows = view === 'daily'
    ? data.trend.map((d) => ({ label: shortDate(d.date), revenue: d.revenue, orders: d.orders }))
    : data.monthly.map((m) => ({ label: monthLabel(m.month), revenue: m.revenue, orders: m.orders }));
  const total = rows.reduce((n, r) => n + r.revenue, 0);
  return (
    <section className="dash-card">
      <header>
        <div><h2>Revenue trend</h2><p>{view === 'daily' ? `${shortDate(data.range.start)} – ${shortDate(data.range.end)}` : 'Last 12 months'} · {formatBDT(total)}</p></div>
        <div className="inv-filters">
          <button className={view === 'daily' ? 'active' : ''} onClick={() => setView('daily')}>Daily</button>
          <button className={view === 'monthly' ? 'active' : ''} onClick={() => setView('monthly')}>Monthly</button>
        </div>
      </header>
      {total === 0 ? <Empty text="No revenue in this period yet." /> : (
        <div className="chart-box">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ORANGE} stopOpacity={0.35} /><stop offset="100%" stopColor={ORANGE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tick={axis} tickLine={false} axisLine={false} width={52} tickFormatter={compactBDT} allowDecimals={false} />
              <Tooltip content={<Tip rows={(p) => [['Revenue', formatBDT(Number(p.revenue))], ['Orders', String(p.orders)]]} />} cursor={{ stroke: ORANGE, strokeDasharray: '4 4' }} />
              <Area type="monotone" dataKey="revenue" stroke={ORANGE} strokeWidth={2.5} fill="url(#revFill)" activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--surface)' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

/* ---------- Orders trend (line) ---------- */
export function OrdersTrend({ data }: { data: DashboardData }) {
  const rows = data.trend.map((d) => ({ label: shortDate(d.date), orders: d.orders, revenue: d.revenue }));
  const total = rows.reduce((n, r) => n + r.orders, 0);
  return (
    <section className="dash-card">
      <header><div><h2>Orders trend</h2><p>{total} order{total === 1 ? '' : 's'} · excluding cancelled</p></div></header>
      {total === 0 ? <Empty text="No orders in this period yet." /> : (
        <div className="chart-box">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tick={axis} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
              <Tooltip content={<Tip rows={(p) => [['Orders', String(p.orders)], ['Revenue', formatBDT(Number(p.revenue))]]} />} cursor={{ stroke: INK, strokeOpacity: 0.2 }} />
              <Line type="monotone" dataKey="orders" stroke={INK} strokeWidth={2.5} dot={rows.length <= 31 ? { r: 3, fill: 'var(--surface)', stroke: INK, strokeWidth: 2 } : false} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

/* ---------- Order status (donut) ---------- */
export function StatusDonut({ data }: { data: DashboardData }) {
  const total = data.statuses.reduce((n, s) => n + s.count, 0);
  const shown = data.statuses.filter((s) => s.count > 0);
  return (
    <section className="dash-card">
      <header><div><h2>Order status</h2><p>All orders placed in this period</p></div></header>
      {total === 0 ? <Empty text="No orders in this period yet." /> : (
        <div className="donut-wrap">
          <div className="donut-chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={shown} dataKey="count" nameKey="status" innerRadius="62%" outerRadius="92%" paddingAngle={shown.length > 1 ? 3 : 0} stroke="none">
                  {shown.map((s) => <Cell key={s.status} fill={STATUS_COLORS[s.status] ?? MUTED} />)}
                </Pie>
                <Tooltip content={<Tip rows={(p) => [['Orders', String(p.count)], ['Share', `${Math.round((Number(p.count) / total) * 100)}%`]]} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center"><strong>{total}</strong><span>orders</span></div>
          </div>
          <ul className="donut-legend">
            {data.statuses.map((s) => (
              <li key={s.status}><i style={{ background: STATUS_COLORS[s.status] }} /><span>{s.status}</span><b>{s.count}</b></li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ---------- Best-selling products (horizontal bar) ---------- */
const trunc = (s: string, n = 18) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
export function TopProducts({ data }: { data: DashboardData }) {
  const rows = data.topProducts.map((p) => ({ ...p, short: trunc(p.name) }));
  return (
    <section className="dash-card">
      <header><div><h2>Best-selling products</h2><p>By units sold in this period</p></div></header>
      {rows.length === 0 ? <Empty text="No product sales in this period yet." /> : (
        <div className="chart-box">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="short" tick={axis} tickLine={false} axisLine={false} width={128} />
              <Tooltip cursor={{ fill: '#17212B0a' }} content={<Tip rows={(p) => [['Product', String(p.name)], ['Units sold', String(p.units)], ['Revenue', formatBDT(Number(p.revenue))]]} />} />
              <Bar dataKey="units" radius={[0, 8, 8, 0]} barSize={18}>
                {rows.map((r, i) => <Cell key={r.id} fill={i === 0 ? ORANGE : 'var(--chart-2)'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
