'use client';
import Link from 'next/link';
import { formatBDT } from '@/lib/products';
import { formatDate } from '@/lib/admin-data';
import type { DashboardData } from '@/lib/dashboard';

export function LowStockTable({ rows }: { rows: DashboardData['lowStock'] }) {
  return (
    <section className="dash-card">
      <header>
        <div><h2>Low stock</h2><p>{rows.length ? `${rows.length} product${rows.length === 1 ? '' : 's'} need attention` : 'Nothing to restock'}</p></div>
        <Link className="text-link" href="/admin/inventory">Manage →</Link>
      </header>
      {rows.length === 0 ? <p className="muted-note">Everything is well stocked.</p> : (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead><tr><th>Product</th><th>Category</th><th className="num">Left</th><th>Status</th></tr></thead>
            <tbody>
              {rows.slice(0, 8).map((p) => (
                <tr key={p.id}>
                  <td className="strong">{p.name}</td><td>{p.category || '—'}</td><td className="num"><b>{p.stock}</b></td>
                  <td><span className={`pill ${p.stock <= 0 ? 'out' : 'low'}`}>{p.stock <= 0 ? 'Out of stock' : 'Low stock'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function RecentOrdersTable({ rows }: { rows: DashboardData['recentOrders'] }) {
  return (
    <section className="dash-card">
      <header><div><h2>Recent orders</h2><p>Latest {rows.length || ''} orders, all time</p></div><Link className="text-link" href="/admin/orders">View all →</Link></header>
      {rows.length === 0 ? <p className="muted-note">No orders yet.</p> : (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th className="num">Total</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td className="strong">#{o.id}</td><td>{o.customer}</td><td>{formatDate(o.createdAt)}</td>
                  <td className="num"><b>{formatBDT(o.total)}</b></td>
                  <td><span className={`pill s-${o.status.toLowerCase()}`}>{o.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
