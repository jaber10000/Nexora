'use client';
import { useState } from 'react';
import { formatBDT } from '@/lib/products';
import { useCatalog } from '@/lib/catalog';
import { useStats } from '@/lib/admin-data';
import { MostViewedProducts } from '@/components/dashboard/most-viewed';

const W = 600, H = 220, PAD = 8;

function SalesChart({ data }: { data: number[] }) {
  // Root cause of the NaN errors: with no sales every value is 0, so max was 0 and v / max = 0 / 0 = NaN.
  // Clamp the scale to at least 1, drop non-finite values, and never divide by zero.
  const pts = data.map((v) => (Number.isFinite(v) ? v : 0));
  const max = Math.max(1, ...pts) * 1.1;
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / Math.max(1, pts.length - 1);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const line = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg className="area-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Daily sales chart" preserveAspectRatio="none">
      {[0.25, 0.5, 0.75].map((g) => <line key={g} x1={0} x2={W} y1={H * g} y2={H * g} className="grid" />)}
      <path d={`${line} L${x(pts.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`} className="area" />
      <path d={line} className="stroke" />
      {pts.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={pts.length > 12 ? 2.5 : 4} className="dot"><title>{formatBDT(v)}</title></circle>)}
    </svg>
  );
}

export default function SalesAnalytics() {
  const { items } = useCatalog();
  const { value: st, ready, error } = useStats();
  const [range, setRange] = useState<7 | 30>(7);
  const days = st.daily.slice(-range);
  const data = days.map((d) => d.sales);
  const revenue = days.reduce((a, d) => a + d.sales, 0);
  const orders = days.reduce((a, d) => a + d.orders, 0);
  const best = items.map((p) => ({ p, units: st.sold[String(p.id)] ?? 0 })).filter((x) => x.units > 0).sort((a, b) => b.units - a.units).slice(0, 5);
  const topUnits = best[0]?.units || 1;
  const monthlyRevenue = st.monthly.length ? st.monthly.map(([k, v]) => [new Date(k + '-01').toLocaleDateString('en-GB', { month: 'short' }), v] as [string, number]) : ([] as [string, number][]);
  const maxM = Math.max(1, ...monthlyRevenue.map(([, v]) => v));
  const yearTotal = monthlyRevenue.reduce((n, [, v]) => n + v, 0);
  const last = monthlyRevenue.length ? monthlyRevenue[monthlyRevenue.length - 1][1] : 0;
  const prev = monthlyRevenue.length > 1 ? monthlyRevenue[monthlyRevenue.length - 2][1] : 0;
  const growth = prev ? `${(((last - prev) / prev) * 100).toFixed(1)}% vs last month` : 'No previous month yet';
  const stats = [
    [`Revenue (${range} days)`, formatBDT(revenue), 'Excluding cancelled'], ['Orders', String(orders), `${range} days`],
    ['Avg. order value', formatBDT(orders ? Math.round(revenue / orders) : 0), 'Per order'], ['This month', formatBDT(last), growth],
  ];

  return (
    <main className="inner-page admin-page">
      <div className="page-intro">
        <span className="eyebrow">NEXORA / ANALYTICS</span>
        <h1>Sales <em>analytics.</em></h1>
        <p>Sales trend, monthly revenue and best-selling products. Figures are calculated from real orders.</p>
      </div>
      <div className="stats-grid">{stats.map(([a, b, c]) => <div className="stat-card" key={a}><span>{a}</span><strong>{b}</strong><small>{c}</small></div>)}</div>

      <div className="admin-preview">
        <div className="inv-tools" style={{ marginBottom: 12 }}>
          <h2 style={{ flex: 1, margin: 0 }}>Sales chart</h2>
          <div className="inv-filters">{([7, 30] as const).map((r) => <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>Last {r} days</button>)}</div>
        </div>
        {!ready ? <p className="muted-note">Loading sales…</p>
          : error ? <p className="muted-note err" role="alert">{error}</p>
          : data.length < 2 ? <p className="muted-note">No sales data yet.</p>
          : <><SalesChart data={data} /><div className="chart-axis"><span>{range} days ago</span><span>Today</span></div></>}
      </div>

      <div className="admin-split" style={{ marginTop: 20 }}>
        <div className="admin-preview">
          <h2>Monthly revenue</h2>
          <p className="muted-note" style={{ paddingTop: 0 }}>Last 12 months · {formatBDT(yearTotal)} total</p>
          {monthlyRevenue.length === 0 && <p className="muted-note">No sales yet.</p>}
          <div className="bars month-bars">
            {monthlyRevenue.map(([m, v], i) => (
              <div key={m + i}><em>{Math.round(v / 1000)}k</em><i style={{ height: `${(v / maxM) * 100}%` }} title={formatBDT(v)} className={i === monthlyRevenue.length - 1 ? 'now' : ''} /><span>{m}</span></div>
            ))}
          </div>
        </div>
        <div className="admin-preview">
          <h2>Best-selling products</h2>
          {best.map(({ p, units }, i) => (
            <div className="rank-row" key={p.id}>
              <span className="rank">{i + 1}</span>
              <div className="inv-thumb" style={{ backgroundImage: `url('${p.image}')` }} />
              <div className="rank-info"><b>{p.name}</b><div className="meter"><i style={{ width: `${(units / topUnits) * 100}%` }} /></div></div>
              <div className="rank-num"><b>{units} sold</b><small>{formatBDT(units * p.price)}</small></div>
            </div>
          ))}
          {best.length === 0 && <p className="muted-note">No products yet.</p>}
        </div>
      </div>
      <MostViewedProducts />
      <div style={{marginTop:20}}><a className="button button-outline" href="/admin/reviews">Manage customer reviews</a></div>
    </main>
  );
}
