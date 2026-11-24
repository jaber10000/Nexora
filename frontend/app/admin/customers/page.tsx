'use client';
import { useState } from 'react';
import { Search, Eye, X } from 'lucide-react';
import { formatBDT } from '@/lib/products';
import { useAdminOrders, useCustomers, formatDate } from '@/lib/admin-data';

export default function CustomerManagement() {
  const { orders } = useAdminOrders();
  const customers = useCustomers(orders);
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const open = customers.find((c) => c.id === openId);
  const shown = customers.filter((c) => (c.name + c.phone + c.email + c.district).toLowerCase().includes(q.trim().toLowerCase()));
  const revenue = customers.reduce((n, c) => n + c.spent, 0);
  const repeat = customers.filter((c) => c.count > 1).length;
  const summary = [['Customers', String(customers.length), 'Have placed an order'], ['Repeat buyers', String(repeat), '2 or more orders'], ['Total spent', formatBDT(revenue), 'Excluding cancelled'], ['Avg. per customer', formatBDT(customers.length ? Math.round(revenue / customers.length) : 0), 'Lifetime value']];
  const initials = (name: string) => name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <main className="inner-page admin-page">
      <div className="page-intro">
        <span className="eyebrow">NEXORA / CUSTOMERS</span>
        <h1>Customer <em>management.</em></h1>
        <p>Browse customers and open their profile and order history. Built from real orders, grouped by phone number.</p>
      </div>
      <div className="stats-grid">{summary.map(([a, b, c]) => <div className="stat-card" key={a}><span>{a}</span><strong>{b}</strong><small>{c}</small></div>)}</div>

      <div className="admin-preview">
        <div className="inv-tools"><label className="inv-search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, email or district" /></label></div>
        <div className="table-scroll">
          <table className="inv-table" style={{ minWidth: 700 }}>
            <thead><tr><th>Customer</th><th>District</th><th>Orders</th><th>Total spent</th><th>Joined</th><th style={{ textAlign: 'right' }}>Details</th></tr></thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id}>
                  <td><div className="inv-product"><div className="avatar">{initials(c.name)}</div><div><b>{c.name}</b><small>{c.email !== '—' ? c.email : c.phone}</small></div></div></td>
                  <td>{c.district}</td><td>{c.count}</td><td>{formatBDT(c.spent)}</td><td>{formatDate(c.joined)}</td>
                  <td><div className="row-actions"><button onClick={() => setOpenId(c.id)}><Eye size={15} /> View</button></div></td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={6} className="muted-note">No customers match.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <div className="modal" role="dialog" aria-modal="true" onClick={() => setOpenId(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><h2>Customer profile</h2><button type="button" onClick={() => setOpenId(null)} aria-label="Close"><X size={18} /></button></div>
            <div className="inv-product" style={{ marginBottom: 18 }}><div className="avatar big">{initials(open.name)}</div><div><b style={{ fontSize: 18 }}>{open.name}</b><small>Customer since {formatDate(open.joined)}</small></div></div>
            <div className="detail-grid">
              <div><span>Phone</span><b>{open.phone}</b></div>
              <div><span>Email</span><b>{open.email}</b></div>
              <div><span>District</span><b>{open.district}</b></div>
              <div><span>Orders · Spent</span><b>{open.count} · {formatBDT(open.spent)}</b></div>
            </div>
            <h3 className="sub-h">Order history</h3>
            {open.orders.length === 0 && <p className="muted-note">No orders yet.</p>}
            {open.orders.map((o) => <div className="order-line" key={o.id}><span>#{o.id} · {formatDate(o.date)}</span><b>{formatBDT(o.total)}</b><small className={`pill s-${o.status.toLowerCase()}`}>{o.status}</small></div>)}
            <div className="modal-foot"><button className="button" onClick={() => setOpenId(null)}>Close</button></div>
          </div>
        </div>
      )}
    </main>
  );
}
