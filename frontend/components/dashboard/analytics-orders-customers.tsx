'use client';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatBDT } from '@/lib/products';
import { compactBDT, monthLabel, shortDate } from '@/lib/dashboard';
import type { AnalyticsData } from '@/lib/analytics';
import { axis, Empty, GRID, INK, ORANGE, STATUS_COLORS, Tip } from './charts';
import { Card, MiniStats, Section } from './analytics-ui';

const margin = { top: 8, right: 8, left: 0, bottom: 0 };

/* ---------- reusable donut ---------- */
function Donut({ rows, center, label }: { rows: { name: string; value: number; color: string }[]; center: string; label: string }) {
  const total = rows.reduce((n, r) => n + r.value, 0);
  const shown = rows.filter((r) => r.value > 0);
  return (
    <div className="donut-wrap">
      <div className="donut-chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={shown} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={shown.length > 1 ? 3 : 0} stroke="none">
              {shown.map((r) => <Cell key={r.name} fill={r.color} />)}
            </Pie>
            <Tooltip content={<Tip rows={(p) => [[label, String(p.value)], ['Share', `${Math.round((Number(p.value) / (total || 1)) * 100)}%`]]} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center"><strong>{total}</strong><span>{center}</span></div>
      </div>
      <ul className="donut-legend">
        {rows.map((r) => <li key={r.name}><i style={{ background: r.color }} /><span>{r.name}</span><b>{r.value}</b></li>)}
      </ul>
    </div>
  );
}

/* ---------- Bangladesh division tile map (geographic cartogram) ---------- */
const TILE_POS: Record<string, { r: number; c: number }> = {
  Rangpur: { r: 1, c: 2 }, Mymensingh: { r: 1, c: 3 }, Sylhet: { r: 1, c: 4 },
  Rajshahi: { r: 2, c: 2 }, Dhaka: { r: 2, c: 3 },
  Khulna: { r: 3, c: 2 }, Barishal: { r: 3, c: 3 }, Chattogram: { r: 3, c: 4 },
};

function DivisionMap({ divisions }: { divisions: AnalyticsData['orders']['divisions'] }) {
  const max = Math.max(1, ...divisions.map((d) => d.orders));
  const other = divisions.find((d) => d.division === 'Other');
  const total = divisions.reduce((n, d) => n + d.orders, 0);
  return (
    <div className="tile-map-wrap">
      <div className="tile-map" role="img" aria-label="Orders by division of Bangladesh">
        {divisions.filter((d) => TILE_POS[d.division]).map((d) => {
          const pos = TILE_POS[d.division];
          const t = d.orders / max;
          return (
            <div key={d.division} className={`tile${t > 0.55 ? ' hot' : ''}`} style={{ gridRow: pos.r, gridColumn: pos.c, background: d.orders ? `color-mix(in srgb, var(--accent) ${Math.round((0.12 + t * 0.78) * 100)}%, transparent)` : 'var(--hover)' }}
              title={`${d.division}: ${d.orders} orders · ${formatBDT(d.revenue)}`}>
              <b>{d.division}</b><strong>{d.orders}</strong><small>{compactBDT(d.revenue)}</small>
            </div>
          );
        })}
      </div>
      <div className="tile-side">
        <h3>Ranking</h3>
        {total === 0 && <p className="muted-note" style={{ padding: 0 }}>No orders in this period yet.</p>}
        {[...divisions].sort((a, b) => b.orders - a.orders).filter((d) => d.orders > 0).map((d) => (
          <div className="rank-line" key={d.division}>
            <span>{d.division}</span>
            <div className="progress"><i className="ok" style={{ width: `${(d.orders / max) * 100}%` }} /></div>
            <b>{d.orders}</b>
          </div>
        ))}
        {other && other.orders > 0 && <small className="muted-note" style={{ padding: 0 }}>“Other” = orders where customers chose “Other” as district.</small>}
        <small className="map-legend"><i style={{ background: 'color-mix(in srgb, var(--accent) 20%, transparent)' }} />Fewer<i style={{ background: 'color-mix(in srgb, var(--accent) 90%, transparent)' }} />More orders</small>
      </div>
    </div>
  );
}

/* ================= Order Analytics ================= */
export function OrderAnalytics({ data }: { data: AnalyticsData }) {
  const o = data.orders;
  const total = o.statuses.reduce((n, s) => n + s.count, 0);
  const get = (s: string) => o.statuses.find((x) => x.status === s)?.count ?? 0;
  const perDay = o.perDay.map((d) => ({ label: shortDate(d.date), orders: d.orders, revenue: d.revenue }));
  const live = perDay.reduce((n, d) => n + d.orders, 0);
  const top = [...o.divisions].sort((a, b) => b.orders - a.orders)[0];
  return (
    <Section title="Order Analytics" hint="Status counts include cancelled orders; daily trend and map count only live orders.">
      <MiniStats items={[
        { label: 'Orders placed', value: String(total), sub: 'All statuses', tone: 'blue' },
        { label: 'Pending / Processing', value: `${get('Pending')} / ${get('Processing')}`, sub: 'Need attention', tone: 'amber' },
        { label: 'Delivered', value: String(get('Delivered')), sub: total ? `${Math.round((get('Delivered') / total) * 100)}% of orders` : '', tone: 'green' },
        { label: 'Cancelled', value: String(get('Cancelled')), sub: total ? `${Math.round((get('Cancelled') / total) * 100)}% of orders` : '', tone: 'red' },
      ]} />
      <div className="dash-grid">
        <Card title="Order status distribution" sub="All orders placed in this period">
          {total === 0 ? <Empty text="No orders in this period yet." /> : (
            <Donut center="orders" label="Orders" rows={o.statuses.map((s) => ({ name: s.status, value: s.count, color: STATUS_COLORS[s.status] ?? 'var(--text-soft)' }))} />
          )}
        </Card>
        <Card title="Orders per day" sub={`${live} live order${live === 1 ? '' : 's'} · ${shortDate(data.range.start)} – ${shortDate(data.range.end)}`}>
          {live === 0 ? <Empty text="No orders in this period yet." /> : (
            <div className="chart-box"><ResponsiveContainer width="100%" height="100%">
              <LineChart data={perDay} margin={margin}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tick={axis} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                <Tooltip content={<Tip rows={(p) => [['Orders', String(p.orders)], ['Revenue', formatBDT(Number(p.revenue))]]} />} cursor={{ stroke: INK, strokeOpacity: 0.2 }} />
                <Line type="monotone" dataKey="orders" stroke={INK} strokeWidth={2.5} dot={perDay.length <= 31 ? { r: 3, fill: 'var(--surface)', stroke: INK, strokeWidth: 2 } : false} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer></div>
          )}
        </Card>
        <Card wide title="Orders by division" sub={top && top.orders ? `Top division: ${top.division} (${top.orders} orders) · Chattogram includes Cumilla, Dhaka includes Gazipur & Narayanganj` : 'Tile map of Bangladesh divisions'}>
          <DivisionMap divisions={o.divisions} />
        </Card>
      </div>
    </Section>
  );
}

/* ================= Customer Analytics ================= */
export function CustomerAnalytics({ data }: { data: AnalyticsData }) {
  const c = data.customers;
  const months = c.monthly.map((m) => ({ label: monthLabel(m.month), new: m.new, returning: m.returning, total: m.total }));
  const buyers = c.newCustomers + c.returningCustomers;
  const maxSpent = Math.max(1, ...c.topSpenders.map((s) => s.spent));
  return (
    <Section title="Customer Analytics" hint="Customers are identified by phone number. “New” = first-ever order falls inside the selected range.">
      <MiniStats items={[
        { label: 'Total customers', value: c.totalCustomers.toLocaleString('en-BD'), sub: 'All time', tone: 'violet' },
        { label: 'Buyers in range', value: String(buyers), sub: 'Unique phone numbers', tone: 'blue' },
        { label: 'New customers', value: String(c.newCustomers), sub: buyers ? `${Math.round((c.newCustomers / buyers) * 100)}% of buyers` : '', tone: 'green' },
        { label: 'Returning customers', value: String(c.returningCustomers), sub: buyers ? `${Math.round((c.returningCustomers / buyers) * 100)}% of buyers` : '', tone: 'orange' },
      ]} />
      <div className="dash-grid">
        <Card title="New vs returning customers" sub="Buyers in the selected range">
          {buyers === 0 ? <Empty text="No buyers in this period yet." /> : (
            <Donut center="buyers" label="Customers" rows={[{ name: 'New', value: c.newCustomers, color: ORANGE }, { name: 'Returning', value: c.returningCustomers, color: 'var(--chart-2)' }]} />
          )}
        </Card>
        <Card title="New vs returning by month" sub="Last 12 months">
          {months.every((m) => m.new + m.returning === 0) ? <Empty text="No customer activity in the last 12 months." /> : (
            <div className="chart-box"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={months} margin={margin}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
                <YAxis tick={axis} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                <Tooltip cursor={{ fill: '#17212B0a' }} content={<Tip rows={(p) => [['New', String(p.new)], ['Returning', String(p.returning)]]} />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="new" name="New" stackId="c" fill={ORANGE} maxBarSize={30} />
                <Bar dataKey="returning" name="Returning" stackId="c" fill="var(--chart-2)" radius={[6, 6, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer></div>
          )}
        </Card>
        <Card title="Customer growth" sub="Cumulative unique customers, last 12 months">
          {c.totalCustomers === 0 ? <Empty text="No customers yet." /> : (
            <div className="chart-box"><ResponsiveContainer width="100%" height="100%">
              <LineChart data={months} margin={margin}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
                <YAxis tick={axis} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
                <Tooltip content={<Tip rows={(p) => [['Total customers', String(p.total)], ['Joined this month', String(p.new)]]} />} cursor={{ stroke: 'var(--success-fill)', strokeDasharray: '4 4' }} />
                <Line type="monotone" dataKey="total" stroke="var(--success-fill)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--surface)', stroke: 'var(--success-fill)', strokeWidth: 2 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer></div>
          )}
        </Card>
        <Card title="Top customers by spending" sub="Selected range, excluding cancelled">
          {c.topSpenders.length === 0 ? <Empty text="No customer spending in this period yet." /> : (
            <div className="rank-list">
              {c.topSpenders.map((s, i) => (
                <div className="rank-line big" key={s.phone}>
                  <span className="rank-n">{i + 1}</span>
                  <div className="rank-who"><b>{s.name}</b><small>{s.phone} · {s.orders} order{s.orders === 1 ? '' : 's'}</small>
                    <div className="progress"><i className="ok" style={{ width: `${(s.spent / maxSpent) * 100}%` }} /></div></div>
                  <b>{formatBDT(s.spent)}</b>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Section>
  );
}
