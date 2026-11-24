'use client';
import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, BarChart3, Boxes, LayoutDashboard, ShoppingBag, Tag, Users, Wallet } from 'lucide-react';
import { presets, useDashboard, type PresetId, type Range } from '@/lib/dashboard';
import { DateFilter } from '@/components/dashboard/date-filter';
import { KpiCards } from '@/components/dashboard/kpi-cards';
import { OrdersTrend, RevenueTrend, StatusDonut, TopProducts } from '@/components/dashboard/charts';
import { useAnalytics } from '@/lib/analytics';
import { RevenueAnalytics, SalesAnalytics } from '@/components/dashboard/analytics-revenue-sales';
import { CustomerAnalytics, OrderAnalytics } from '@/components/dashboard/analytics-orders-customers';
import { CouponAnalytics, InventoryAnalytics } from '@/components/dashboard/analytics-inventory-coupons';
import { LowStockTable, RecentOrdersTable } from '@/components/dashboard/tables';
import './dashboard.css';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'revenue', label: 'Revenue', icon: Wallet },
  { id: 'sales', label: 'Sales', icon: BarChart3 },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
  { id: 'coupons', label: 'Coupons', icon: Tag },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function Admin() {
  const [preset, setPreset] = useState<PresetId>('30d');
  const [range, setRange] = useState<Range>(() => presets[2].range());
  const [tab, setTab] = useState<TabId>('overview');
  const { data, loading, error, reload } = useDashboard(range);
  const an = useAnalytics(range, tab !== 'overview');

  const alerts = data ? data.kpis.lowStock + data.kpis.outOfStock : 0;

  return (
    <main className="inner-page admin-page">
      <div className="dash-top">
        <div className="page-intro">
          <span className="eyebrow">NEXORA / CONTROL ROOM</span>
          <h1>Dashboard <em>overview.</em></h1>
          <p>Live figures from your store database.</p>
        </div>
        <DateFilter preset={preset} range={range} onChange={(p, r) => { setPreset(p); setRange(r); }} />
      </div>

      <nav className="dash-tabs" role="tablist" aria-label="Dashboard sections">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={15} />{label}</button>
        ))}
      </nav>

      {tab !== 'overview' && (
        <>
          {an.error && (
            <div className="dash-alert err" role="alert"><AlertTriangle size={18} /><span>{an.error}</span><button onClick={an.reload}>Retry</button></div>
          )}
          {!an.data && an.loading && !an.error && <p className="muted-note">Loading analytics…</p>}
          {an.data && (
            <div className={`analytics-body${an.loading ? ' is-loading' : ''}`}>
              {tab === 'revenue' && <RevenueAnalytics data={an.data} />}
              {tab === 'sales' && <SalesAnalytics data={an.data} />}
              {tab === 'orders' && <OrderAnalytics data={an.data} />}
              {tab === 'customers' && <CustomerAnalytics data={an.data} />}
              {tab === 'inventory' && <InventoryAnalytics data={an.data} />}
              {tab === 'coupons' && <CouponAnalytics data={an.data} />}
            </div>
          )}
        </>
      )}

      {tab === 'overview' && error && (
        <div className="dash-alert err" role="alert">
          <AlertTriangle size={18} /><span>{error}</span><button onClick={reload}>Retry</button>
        </div>
      )}
      {tab === 'overview' && !data && loading && !error && <p className="muted-note">Loading dashboard…</p>}

      {tab === 'overview' && data && (
        <>
          {alerts > 0 && (
            <div className="dash-alert" role="status">
              <AlertTriangle size={18} />
              <span>
                {data.kpis.outOfStock > 0 && <><b>{data.kpis.outOfStock}</b> product{data.kpis.outOfStock === 1 ? ' is' : 's are'} out of stock</>}
                {data.kpis.outOfStock > 0 && data.kpis.lowStock > 0 && ' and '}
                {data.kpis.lowStock > 0 && <><b>{data.kpis.lowStock}</b> running low</>}.
              </span>
              <Link href="/admin/inventory">Restock now →</Link>
            </div>
          )}

          <KpiCards k={data.kpis} days={data.range.days} loading={loading} />

          <div className="dash-grid">
            <RevenueTrend data={data} />
            <OrdersTrend data={data} />
          </div>
          <div className="dash-grid">
            <StatusDonut data={data} />
            <TopProducts data={data} />
          </div>
          <div className="dash-grid">
            <LowStockTable rows={data.lowStock} />
            <RecentOrdersTable rows={data.recentOrders} />
          </div>
        </>
      )}
    </main>
  );
}
