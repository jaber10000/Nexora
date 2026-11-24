'use client';
// Customer order history: search + status filter, totals, quick access to tracking, invoice, cancel and refund.
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronRight, Package, Search } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { OrderActions, OrderProgress, RefundNotice, RefundPill, StatusPill } from '@/components/order-parts';
import { formatBDT } from '@/lib/products';
import { fetchMyOrders, paymentMethods, shippingOptions, type Order } from '@/lib/orders';
import { OrderReview } from '@/components/order-review';

const FILTERS = ['All', 'Active', 'Delivered', 'Cancelled'] as const;
type Filter = (typeof FILTERS)[number];
const isActive = (o: Order) => !['Delivered', 'Cancelled'].includes(o.status ?? 'Pending');

function OrdersInner() {
  const { user, ready } = useAuth();
  const placed = useSearchParams().get('placed');
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('All');
  // status set in the admin panel shows up here (loaded from the database)
  useEffect(() => {
    if (!user) { setOrders([]); return; }
    fetchMyOrders().then(setOrders).catch((e) => { setError(e.message); setOrders([]); });
  }, [user]);
  const replace = (o: Order) => setOrders((list) => (list ?? []).map((x) => (x.id === o.id ? o : x)));

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (orders ?? []).filter((o) => {
      const st = o.status ?? 'Pending';
      if (filter === 'Active' && !isActive(o)) return false;
      if (filter === 'Delivered' && st !== 'Delivered') return false;
      if (filter === 'Cancelled' && st !== 'Cancelled') return false;
      return !needle || (o.id + o.lines.map((l) => l.name).join(' ')).toLowerCase().includes(needle);
    });
  }, [orders, q, filter]);

  if (!ready || orders === null) return null;
  if (!user) {
    return (
      <div className="cart-empty">
        <p>Please sign in to see your orders.</p>
        <Link href="/login" className="button button-orange">Sign in</Link>
      </div>
    );
  }
  if (error) return <div className="cart-empty"><p>{error}</p></div>;
  if (orders.length === 0) {
    return (
      <div className="cart-empty">
        <Package size={38} />
        <p>You have no orders yet.</p>
        <Link href="/products" className="button button-orange">Start shopping</Link>
      </div>
    );
  }

  const spent = orders.filter((o) => o.status !== 'Cancelled').reduce((n, o) => n + o.total - (o.refund?.status === 'Refunded' ? o.refund.amount : 0), 0);
  const summary = [['Orders', String(orders.length)], ['In progress', String(orders.filter(isActive).length)], ['Delivered', String(orders.filter((o) => o.status === 'Delivered').length)], ['Total spent', formatBDT(spent)]];

  return (
    <div className="orders-list">
      {placed && <div className="order-banner">Thank you! Your order <b>#{placed}</b> has been placed. We emailed you the confirmation and invoice.</div>}
      <div className="oh-summary">{summary.map(([a, b]) => <div key={a}><span>{a}</span><strong>{b}</strong></div>)}</div>
      <div className="oh-tools">
        <label className="inv-search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by order number or product" aria-label="Search orders" /></label>
        <div className="inv-filters">{FILTERS.map((f) => <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{f}</button>)}</div>
      </div>
      {shown.length === 0 && <div className="cart-empty"><p>No orders match your search.</p></div>}
      {shown.map((o) => {
        const st = o.status ?? 'Pending';
        const latest = o.timeline?.[o.timeline.length - 1];
        return (
          <article className="order-card" key={o.id}>
            <header>
              <div><span className="eyebrow">ORDER</span><h3>#{o.id}</h3></div>
              <div className="order-meta">
                <span>{new Date(o.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <strong>{formatBDT(o.total)}</strong>
                {o.discount ? <small>Coupon {o.coupon} −{formatBDT(o.discount)}</small> : null}
              </div>
            </header>
            <div className="oh-badges"><StatusPill status={st} /><RefundPill order={o} />{o.paymentStatus && <span className={`pill pay-${o.paymentStatus.toLowerCase().replace(' ', '-')}`}>{o.paymentStatus}</span>}</div>
            {st === 'Cancelled' ? <div className="order-banner bad">Cancelled{o.cancelReason ? `: ${o.cancelReason}` : ''}</div> : <OrderProgress status={st} />}
            <RefundNotice order={o} />
            {latest && st !== 'Cancelled' && <p className="oh-latest"><b>{latest.title}</b>{latest.note ? ` — ${latest.note}` : ''}</p>}
            <div className="order-items">
              {o.lines.map((l) => (
                <div key={l.id}>
                  <span className="cart-thumb" style={{ backgroundImage: `url('${l.image}')` }} />
                  <span>{l.name} × {l.quantity}<OrderReview productId={l.id} productName={l.name} delivered={st === 'Delivered'} /></span>
                  <span>{formatBDT(l.price * l.quantity)}</span>
                </div>
              ))}
            </div>
            <footer>
              <span>{paymentMethods.find((p) => p.id === o.payment)?.label} · {shippingOptions.find((s) => s.id === o.shipping)?.label}</span>
              <span>{o.address.address}, {o.address.area}, {o.address.district} · {o.address.phone}</span>
            </footer>
            <div className="oh-foot">
              <OrderActions order={o} onChange={replace} />
              <Link href={`/orders/${o.id}`} className="oa-btn primary">Track order <ChevronRight size={15} /></Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <main className="inner-page">
      <div className="page-intro">
        <span className="eyebrow">YOUR PURCHASES</span>
        <h1>My <em>orders.</em></h1>
      </div>
      <Suspense fallback={null}><OrdersInner /></Suspense>
    </main>
  );
}
