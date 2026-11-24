'use client';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatBDT } from '@/lib/products';
import { compactBDT, monthLabel } from '@/lib/dashboard';
import { trunc, type AnalyticsData } from '@/lib/analytics';
import { axis, Empty, GRID, ORANGE, Tip } from './charts';
import { Card, MiniStats, Progress, Section } from './analytics-ui';

const margin = { top: 8, right: 8, left: 0, bottom: 0 };
const stockColor = (n: number, low: number) => (n <= 0 ? 'var(--error-fill)' : n <= low ? 'var(--chart-5)' : 'var(--success-fill)');

/* ================= Inventory Analytics ================= */
export function InventoryAnalytics({ data }: { data: AnalyticsData }) {
  const inv = data.inventory;
  const low = inv.lowThreshold;
  const healthy = inv.total - inv.lowStockCount - inv.outOfStockCount;
  const levels = inv.levels.map((p) => ({ ...p, short: trunc(p.name, 16) }));
  return (
    <Section title="Inventory Analytics" hint={`Active products only. “Low” means ${low} units or fewer.`}>
      <div className="counter-row">
        <div className={`counter ${inv.outOfStockCount ? 'bad' : 'ok'}`}><span>Out of stock</span><strong>{inv.outOfStockCount}</strong><small>{inv.outOfStockCount ? 'Products unavailable to buy' : 'Nothing is sold out'}</small></div>
        <div className={`counter ${inv.lowStockCount ? 'warn' : 'ok'}`}><span>Low stock</span><strong>{inv.lowStockCount}</strong><small>1–{low} units left</small></div>
        <div className="counter ok"><span>Healthy stock</span><strong>{Math.max(0, healthy)}</strong><small>of {inv.total} active products</small></div>
      </div>
      <div className="dash-grid">
        <Card title="Low stock alert" sub="Bar fills toward the low-stock threshold">
          {inv.lowStock.length === 0 ? <Empty text="Everything is well stocked." /> : (
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead><tr><th>Product</th><th>Category</th><th style={{ width: '34%' }}>Level</th><th style={{ textAlign: 'right' }}>Left</th></tr></thead>
                <tbody>
                  {inv.lowStock.map((p) => (
                    <tr key={p.id}>
                      <td><b>{trunc(p.name, 26)}</b></td><td>{p.category || '—'}</td>
                      <td><Progress pct={(p.stock / low) * 100} tone={p.stock <= 0 ? 'bad' : 'warn'} /></td>
                      <td style={{ textAlign: 'right' }}><b style={{ color: stockColor(p.stock, low) }}>{p.stock <= 0 ? 'Out' : p.stock}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="Stock level by product" sub={`Lowest ${levels.length} products · dashed line = low-stock threshold`}>
          {levels.length === 0 ? <Empty text="No products yet." /> : (
            <div className="chart-box tall" style={{ height: Math.max(280, levels.length * 26) }}><ResponsiveContainer width="100%" height="100%">
              <BarChart data={levels} layout="vertical" margin={{ ...margin, right: 24 }}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="short" tick={axis} tickLine={false} axisLine={false} width={120} interval={0} />
                <Tooltip cursor={{ fill: '#17212B0a' }} content={<Tip rows={(p) => [['Product', String(p.name)], ['Category', String(p.category || '—')], ['In stock', String(p.stock)]]} />} />
                <ReferenceLine x={low} stroke="var(--chart-5)" strokeDasharray="4 4" />
                <Bar dataKey="stock" radius={[0, 8, 8, 0]} barSize={14} minPointSize={3}>{levels.map((p) => <Cell key={p.id} fill={stockColor(p.stock, low)} />)}</Bar>
              </BarChart>
            </ResponsiveContainer></div>
          )}
        </Card>
        <Card wide title="Out-of-stock products" sub={`${inv.outOfStockCount} product${inv.outOfStockCount === 1 ? '' : 's'}`}>
          {inv.outOfStock.length === 0 ? <Empty text="No products are out of stock." /> : (
            <div className="chip-list">{inv.outOfStock.map((p) => <span className="chip bad" key={p.id}>{p.name}<small>{p.category}</small></span>)}</div>
          )}
        </Card>
      </div>
    </Section>
  );
}

/* ================= Coupon Analytics ================= */
export function CouponAnalytics({ data }: { data: AnalyticsData }) {
  const c = data.coupons;
  const months = c.monthly.map((m) => ({ label: monthLabel(m.month), discount: m.discount, revenue: m.revenue }));
  const mixed = [{ name: 'With coupon', value: c.ordersWithCoupon, color: ORANGE }, { name: 'No coupon', value: Math.max(0, c.orders - c.ordersWithCoupon), color: 'var(--chart-muted)' }];
  const maxUses = Math.max(1, ...c.topCoupons.map((t) => t.uses));
  return (
    <Section title="Coupon Analytics" hint="Discount figures come from orders placed in the selected range (cancelled excluded).">
      <MiniStats items={[
        { label: 'Coupon usage rate', value: `${c.usageRate}%`, sub: `${c.ordersWithCoupon} of ${c.orders} orders`, tone: 'orange' },
        { label: 'Discount given', value: formatBDT(c.discountGiven), sub: `${c.discountPct}% of pre-discount sales`, tone: 'red' },
        { label: 'Net revenue', value: formatBDT(c.revenue), sub: 'After discounts', tone: 'green' },
        { label: 'Active coupons', value: String(c.list.filter((x) => x.active).length), sub: `${c.list.length} total`, tone: 'violet' },
      ]} />
      <div className="dash-grid">
        <Card title="Coupon usage rate" sub="Share of orders that used a coupon">
          {c.orders === 0 ? <Empty text="No orders in this period yet." /> : (
            <div className="donut-wrap">
              <div className="donut-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={mixed.filter((m) => m.value > 0)} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={c.ordersWithCoupon ? 3 : 0} stroke="none">
                      {mixed.filter((m) => m.value > 0).map((m) => <Cell key={m.name} fill={m.color} />)}
                    </Pie>
                    <Tooltip content={<Tip rows={(p) => [['Orders', String(p.value)]]} />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center"><strong>{c.usageRate}%</strong><span>used a coupon</span></div>
              </div>
              <ul className="donut-legend">{mixed.map((m) => <li key={m.name}><i style={{ background: m.color }} /><span>{m.name}</span><b>{m.value}</b></li>)}</ul>
            </div>
          )}
        </Card>
        <Card title="Discount given vs revenue" sub="Last 12 months">
          {months.every((m) => m.revenue === 0) ? <Empty text="No sales in the last 12 months." /> : (
            <div className="chart-box"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={months} margin={margin}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
                <YAxis tick={axis} tickLine={false} axisLine={false} width={52} tickFormatter={compactBDT} />
                <Tooltip cursor={{ fill: '#17212B0a' }} content={<Tip rows={(p) => [['Revenue', formatBDT(Number(p.revenue))], ['Discount', formatBDT(Number(p.discount))]]} />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" name="Revenue" fill="var(--chart-2)" radius={[6, 6, 0, 0]} maxBarSize={20} />
                <Bar dataKey="discount" name="Discount" fill="var(--error-fill)" radius={[6, 6, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer></div>
          )}
        </Card>
        <Card title="Most used coupons" sub="Selected range">
          {c.topCoupons.length === 0 ? <Empty text="No coupons were used in this period." /> : (
            <div className="rank-list">
              {c.topCoupons.map((t, i) => (
                <div className="rank-line big" key={t.code}>
                  <span className="rank-n">{i + 1}</span>
                  <div className="rank-who"><b>{t.code}</b><small>{t.uses} use{t.uses === 1 ? '' : 's'} · {formatBDT(t.discount)} discount</small>
                    <div className="progress"><i className="ok" style={{ width: `${(t.uses / maxUses) * 100}%` }} /></div></div>
                  <b>{formatBDT(t.revenue)}</b>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="Coupon limits" sub="Lifetime usage vs limit">
          {c.list.length === 0 ? <Empty text="No coupons created yet." /> : (
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead><tr><th>Code</th><th>Offer</th><th style={{ width: '32%' }}>Usage</th><th style={{ textAlign: 'right' }}>Used</th></tr></thead>
                <tbody>
                  {c.list.slice(0, 8).map((x) => (
                    <tr key={x.code}>
                      <td><b>{x.code}</b>{!x.active && <small className="pill out" style={{ marginLeft: 6 }}>Off</small>}</td>
                      <td>{x.type === 'percent' ? `${x.value}%` : formatBDT(x.value)}</td>
                      <td>{x.usageRate === null ? <small className="muted">Unlimited</small> : <Progress pct={x.usageRate} tone={x.usageRate >= 90 ? 'bad' : x.usageRate >= 60 ? 'warn' : 'ok'} />}</td>
                      <td style={{ textAlign: 'right' }}>{x.used}{x.limit ? ` / ${x.limit}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </Section>
  );
}
