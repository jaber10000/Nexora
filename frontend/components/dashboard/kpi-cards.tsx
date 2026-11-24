'use client';
import { TrendingUp, TrendingDown, ShoppingBag, Users, Package, Zap, AlertTriangle, Wallet, type LucideIcon } from 'lucide-react';
import { formatBDT } from '@/lib/products';
import type { Kpis } from '@/lib/dashboard';

function Delta({ v }: { v: number | null }) {
  if (v === null) return <small className="delta flat">No prior data</small>;
  const up = v >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return <small className={`delta ${up ? 'up' : 'down'}`}><Icon size={12} /> {up ? '+' : ''}{v}% vs previous period</small>;
}

type Card = { label: string; value: string; icon: LucideIcon; tone?: 'orange' | 'blue' | 'green' | 'violet' | 'amber' | 'red'; foot: React.ReactNode };

export function KpiCards({ k, days, loading }: { k: Kpis; days: number; loading: boolean }) {
  const stockAlerts = k.lowStock + k.outOfStock;
  const cards: Card[] = [
    { label: 'Total Revenue', value: formatBDT(k.revenue), icon: Wallet, tone: 'orange', foot: <Delta v={k.revenueChange} /> },
    { label: 'Total Orders', value: k.orders.toLocaleString('en-BD'), icon: ShoppingBag, tone: 'blue', foot: <Delta v={k.ordersChange} /> },
    { label: 'Total Customers', value: k.customers.toLocaleString('en-BD'), icon: Users, tone: 'violet', foot: <small className="delta flat">{k.customersInRange} bought in last {days}d</small> },
    { label: 'Products', value: k.products.toLocaleString('en-BD'), icon: Package, tone: 'green', foot: <small className="delta flat">Active in the store</small> },
    { label: "Today's Sales", value: formatBDT(k.todaySales), icon: Zap, tone: 'amber', foot: <small className="delta flat">{k.todayOrders} order{k.todayOrders === 1 ? '' : 's'} today</small> },
    { label: 'Low Stock Items', value: String(stockAlerts), icon: AlertTriangle, tone: stockAlerts ? 'red' : 'green', foot: <small className="delta flat">{k.outOfStock} out · {k.lowStock} low</small> },
  ];
  return (
    <div className={`kpi-grid${loading ? ' is-loading' : ''}`}>
      {cards.map(({ label, value, icon: Icon, tone = 'orange', foot }) => (
        <div className="kpi-card" key={label}>
          <div className="kpi-head"><span>{label}</span><i className={`kpi-icon tone-${tone}`}><Icon size={17} /></i></div>
          <strong>{value}</strong>
          {foot}
        </div>
      ))}
    </div>
  );
}
