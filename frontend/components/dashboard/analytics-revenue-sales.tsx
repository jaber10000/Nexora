'use client';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, ResponsiveContainer, Tooltip, Treemap, XAxis, YAxis } from 'recharts';
import { formatBDT } from '@/lib/products';
import { compactBDT, monthLabel, shortDate } from '@/lib/dashboard';
import { trunc, type AnalyticsData } from '@/lib/analytics';
import { axis, Empty, GRID, INK, ORANGE, Tip } from './charts';
import { Card, MiniStats, PALETTE, Section } from './analytics-ui';

const margin = { top: 8, right: 8, left: 0, bottom: 0 };

/* ================= Revenue Analytics ================= */
export function RevenueAnalytics({ data }: { data: AnalyticsData }) {
  const { daily, monthly, yearly, total, orders } = data.revenue;
  const days = daily.map((d) => ({ label: shortDate(d.date), revenue: d.revenue, orders: d.orders }));
  const months = monthly.map((m) => ({ label: monthLabel(m.month), revenue: m.revenue, orders: m.orders }));
  const bestMonth = monthly.reduce((b, m) => (m.revenue > b.revenue ? m : b), monthly[0]);
  const yearTotal = monthly.reduce((n, m) => n + m.revenue, 0);

  return (
    <Section title="Revenue Analytics" hint="Cancelled orders are excluded from every figure.">
      <MiniStats items={[
        { label: 'Revenue (selected range)', value: formatBDT(total), sub: `${orders} orders`, tone: 'orange' },
        { label: 'Avg. order value', value: formatBDT(orders ? Math.round(total / orders) : 0), sub: 'Per order', tone: 'blue' },
        { label: 'Last 12 months', value: formatBDT(yearTotal), sub: 'Rolling total', tone: 'green' },
        { label: 'Best month', value: bestMonth && bestMonth.revenue ? monthLabel(bestMonth.month) : '—', sub: bestMonth ? formatBDT(bestMonth.revenue) : '', tone: 'violet' },
      ]} />
      <div className="dash-grid">
        <Card title="Daily revenue" sub={`${shortDate(data.range.start)} – ${shortDate(data.range.end)}`}>
          {total === 0 ? <Empty text="No revenue in this period yet." /> : (
            <div className="chart-box"><ResponsiveContainer width="100%" height="100%">
              <LineChart data={days} margin={margin}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tick={axis} tickLine={false} axisLine={false} width={52} tickFormatter={compactBDT} allowDecimals={false} />
                <Tooltip content={<Tip rows={(p) => [['Revenue', formatBDT(Number(p.revenue))], ['Orders', String(p.orders)]]} />} cursor={{ stroke: ORANGE, strokeDasharray: '4 4' }} />
                <Line type="monotone" dataKey="revenue" stroke={ORANGE} strokeWidth={2.5} dot={days.length <= 31 ? { r: 3, fill: 'var(--surface)', stroke: ORANGE, strokeWidth: 2 } : false} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer></div>
          )}
        </Card>

        <Card title="Monthly revenue" sub="Last 12 months">
          {yearTotal === 0 ? <Empty text="No revenue in the last 12 months." /> : (
            <div className="chart-box"><ResponsiveContainer width="100%" height="100%">
              <AreaChart data={months} margin={margin}>
                <defs><linearGradient id="monFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
                <YAxis tick={axis} tickLine={false} axisLine={false} width={52} tickFormatter={compactBDT} allowDecimals={false} />
                <Tooltip content={<Tip rows={(p) => [['Revenue', formatBDT(Number(p.revenue))], ['Orders', String(p.orders)]]} />} cursor={{ stroke: 'var(--chart-2)', strokeDasharray: '4 4' }} />
                <Area type="monotone" dataKey="revenue" stroke="var(--chart-2)" strokeWidth={2.5} fill="url(#monFill)" activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--surface)' }} />
              </AreaChart>
            </ResponsiveContainer></div>
          )}
        </Card>

        <Card title="Yearly revenue trend" sub="All time, by calendar year">
          {yearly.every((y) => y.revenue === 0) ? <Empty text="No sales recorded yet." /> : (
            <div className="chart-box"><ResponsiveContainer width="100%" height="100%">
              <LineChart data={yearly} margin={{ ...margin, left: 8, right: 20 }}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="year" tick={axis} tickLine={false} axisLine={false} />
                <YAxis tick={axis} tickLine={false} axisLine={false} width={52} tickFormatter={compactBDT} allowDecimals={false} />
                <Tooltip content={<Tip rows={(p) => [['Revenue', formatBDT(Number(p.revenue))], ['Orders', String(p.orders)]]} />} cursor={{ stroke: INK, strokeOpacity: 0.2 }} />
                <Line type="monotone" dataKey="revenue" stroke="var(--chart-3)" strokeWidth={2.5} dot={{ r: 5, fill: 'var(--surface)', stroke: 'var(--chart-3)', strokeWidth: 2 }} activeDot={{ r: 7 }} />
              </LineChart>
            </ResponsiveContainer></div>
          )}
        </Card>

        <Card title="Revenue vs orders" sub="Revenue (line, left axis) · orders (bars, right axis)">
          {total === 0 ? <Empty text="No revenue in this period yet." /> : (
            <div className="chart-box"><ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={days} margin={margin}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis yAxisId="rev" tick={axis} tickLine={false} axisLine={false} width={52} tickFormatter={compactBDT} allowDecimals={false} />
                <YAxis yAxisId="ord" orientation="right" tick={axis} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
                <Tooltip content={<Tip rows={(p) => [['Revenue', formatBDT(Number(p.revenue))], ['Orders', String(p.orders)]]} />} cursor={{ fill: '#17212B0a' }} />
                <Bar yAxisId="ord" dataKey="orders" fill="var(--chart-muted)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Line yAxisId="rev" type="monotone" dataKey="revenue" stroke={ORANGE} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer></div>
          )}
        </Card>
      </div>
    </Section>
  );
}

/* ================= Sales Analytics ================= */
type TreeProps = { x?: number; y?: number; width?: number; height?: number; name?: string; index?: number; size?: number };
function TreeCell({ x = 0, y = 0, width = 0, height = 0, name = '', index = 0, size = 0 }: TreeProps) {
  const big = width > 70 && height > 38;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={6} fill={PALETTE[index % PALETTE.length]} stroke="var(--surface)" strokeWidth={2} />
      {big && (
        <>
          <text x={x + 10} y={y + 20} fill="var(--surface)" fontSize={12} fontWeight={700}>{trunc(name, Math.max(6, Math.floor(width / 8)))}</text>
          <text x={x + 10} y={y + 36} fill="#ffffffcc" fontSize={11}>{compactBDT(size)}</text>
        </>
      )}
    </g>
  );
}

export function SalesAnalytics({ data }: { data: AnalyticsData }) {
  const s = data.sales;
  const best = s.bestSelling.map((p) => ({ ...p, short: trunc(p.name, 12) }));
  const prodRev = s.productRevenue.map((p) => ({ ...p, short: trunc(p.name, 12) }));
  const cats = s.topCategories.map((c) => ({ ...c, short: trunc(c.category, 14) }));
  const tree = s.performance.map((p) => ({ name: p.name, size: p.revenue, units: p.units }));
  const units = s.bestSelling.reduce((n, p) => n + p.units, 0);
  const none = s.performance.length === 0;

  return (
    <Section title="Sales Analytics" hint="Product figures use unit price × quantity (before order-level coupon discounts).">
      <MiniStats items={[
        { label: 'Products sold', value: String(s.performance.length), sub: 'Distinct products in range', tone: 'blue' },
        { label: 'Units (top 8)', value: units.toLocaleString('en-BD'), sub: 'Best sellers combined', tone: 'orange' },
        { label: 'Top product', value: s.bestSelling[0] ? trunc(s.bestSelling[0].name, 18) : '—', sub: s.bestSelling[0] ? `${s.bestSelling[0].units} units` : '', tone: 'green' },
        { label: 'Top category', value: s.topCategories[0]?.category ?? '—', sub: s.topCategories[0] ? formatBDT(s.topCategories[0].revenue) : '', tone: 'violet' },
      ]} />
      <div className="dash-grid">
        <Card title="Best-selling products" sub="By units sold">
          {none ? <Empty text="No product sales in this period yet." /> : (
            <div className="chart-box"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={best} margin={margin}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="short" tick={axis} tickLine={false} axisLine={false} interval={0} />
                <YAxis tick={axis} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                <Tooltip cursor={{ fill: '#17212B0a' }} content={<Tip rows={(p) => [['Product', String(p.name)], ['Units', String(p.units)], ['Revenue', formatBDT(Number(p.revenue))]]} />} />
                <Bar dataKey="units" radius={[8, 8, 0, 0]} maxBarSize={38}>{best.map((_, i) => <Cell key={i} fill={i === 0 ? ORANGE : 'var(--chart-2)'} />)}</Bar>
              </BarChart>
            </ResponsiveContainer></div>
          )}
        </Card>

        <Card title="Top categories" sub="Revenue by category">
          {cats.length === 0 ? <Empty text="No category sales in this period yet." /> : (
            <div className="chart-box"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={cats} layout="vertical" margin={{ ...margin, right: 24 }}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={axis} tickLine={false} axisLine={false} tickFormatter={compactBDT} />
                <YAxis type="category" dataKey="short" tick={axis} tickLine={false} axisLine={false} width={96} />
                <Tooltip cursor={{ fill: '#17212B0a' }} content={<Tip rows={(p) => [['Category', String(p.category)], ['Revenue', formatBDT(Number(p.revenue))], ['Units', String(p.units)]]} />} />
                <Bar dataKey="revenue" radius={[0, 8, 8, 0]} barSize={20}>{cats.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer></div>
          )}
        </Card>

        <Card title="Product performance" sub="Treemap · tile size = revenue (top 20)">
          {none ? <Empty text="No product sales in this period yet." /> : (
            <div className="chart-box"><ResponsiveContainer width="100%" height="100%">
              <Treemap data={tree} dataKey="size" nameKey="name" stroke="var(--surface)" content={<TreeCell />} isAnimationActive={false}>
                <Tooltip content={<Tip rows={(p) => [['Product', String(p.name)], ['Revenue', formatBDT(Number(p.size))], ['Units', String(p.units)]]} />} />
              </Treemap>
            </ResponsiveContainer></div>
          )}
        </Card>

        <Card title="Product-wise revenue" sub="Top 8 products by revenue">
          {none ? <Empty text="No product sales in this period yet." /> : (
            <div className="chart-box"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={prodRev} margin={margin}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="short" tick={axis} tickLine={false} axisLine={false} interval={0} />
                <YAxis tick={axis} tickLine={false} axisLine={false} width={52} tickFormatter={compactBDT} />
                <Tooltip cursor={{ fill: '#17212B0a' }} content={<Tip rows={(p) => [['Product', String(p.name)], ['Revenue', formatBDT(Number(p.revenue))], ['Units', String(p.units)]]} />} />
                <Bar dataKey="revenue" fill="var(--chart-2)" radius={[8, 8, 0, 0]} maxBarSize={38} />
              </BarChart>
            </ResponsiveContainer></div>
          )}
        </Card>
      </div>
    </Section>
  );
}
