'use client';
import { useState } from 'react';
import { Minus, Plus, Search, AlertTriangle } from 'lucide-react';
import { formatBDT } from '@/lib/products';
import { useStock, stockStatus, statusLabel, LOW_STOCK, type StockStatus } from '@/lib/stock';

export default function Inventory() {
  const { rows, setStock } = useStock();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | StockStatus>('all');

  const shown = rows.filter(
    (r) => (filter === 'all' || stockStatus(r.stock) === filter) &&
      (r.name + r.category).toLowerCase().includes(q.trim().toLowerCase()),
  );
  const count = (s: StockStatus) => rows.filter((r) => stockStatus(r.stock) === s).length;
  const units = rows.reduce((n, r) => n + r.stock, 0);
  const summary = [
    ['Total units', String(units), `${rows.length} products`],
    ['In stock', String(count('in')), 'Healthy levels'],
    ['Low stock', String(count('low')), `${LOW_STOCK} or fewer`],
    ['Out of stock', String(count('out')), 'Hidden from sale soon'],
  ];

  return (
    <main className="inner-page admin-page">
      <div className="page-intro">
        <span className="eyebrow">NEXORA / INVENTORY</span>
        <h1>Stock <em>management.</em></h1>
        <p>Adjust quantities and watch availability update. Changes are saved to the database.</p>
      </div>
      {(count('low') > 0 || count('out') > 0) && (
        <div className={`low-alert ${count('out') > 0 ? 'critical' : ''}`} role="alert">
          <AlertTriangle size={20} />
          <div>
            <b>Low stock warning</b>
            {count('out') > 0 && <>Out of stock: {rows.filter((r) => stockStatus(r.stock) === 'out').map((r) => r.name).join(', ')}. </>}
            {count('low') > 0 && <>Running low (≤ {LOW_STOCK}): {rows.filter((r) => stockStatus(r.stock) === 'low').map((r) => `${r.name} (${r.stock})`).join(', ')}.</>}
          </div>
        </div>
      )}
      <div className="stats-grid">
        {summary.map(([n, v, s]) => (
          <div className="stat-card" key={n}><span>{n}</span><strong>{v}</strong><small>{s}</small></div>
        ))}
      </div>
      <div className="admin-preview">
        <div className="inv-tools">
          <label className="inv-search"><Search size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products or categories" />
          </label>
          <div className="inv-filters">
            {(['all', 'in', 'low', 'out'] as const).map((f) => (
              <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : statusLabel[f]}
              </button>
            ))}
          </div>
        </div>
        <div className="table-scroll">
          <table className="inv-table">
            <thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Status</th></tr></thead>
            <tbody>
              {shown.map((r) => {
                const s = stockStatus(r.stock);
                return (
                  <tr key={r.id}>
                    <td>
                      <div className="inv-product">
                        <div className="inv-thumb" style={{ backgroundImage: `url('${r.image}')` }} />
                        <div><b>{r.name}</b><small>{r.category}</small></div>
                      </div>
                    </td>
                    <td>{formatBDT(r.price)}</td>
                    <td>
                      <div className="qty-ctl">
                        <button aria-label={`Decrease ${r.name}`} onClick={() => setStock(r.id, r.stock - 1)}><Minus size={14} /></button>
                        <input aria-label={`${r.name} quantity`} type="number" min={0} value={r.stock}
                          onChange={(e) => setStock(r.id, Number(e.target.value))} />
                        <button aria-label={`Increase ${r.name}`} onClick={() => setStock(r.id, r.stock + 1)}><Plus size={14} /></button>
                      </div>
                    </td>
                    <td><span className={`pill ${s}`}>{statusLabel[s]}</span></td>
                  </tr>
                );
              })}
              {shown.length === 0 && <tr><td colSpan={4} className="muted-note">No products match.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
