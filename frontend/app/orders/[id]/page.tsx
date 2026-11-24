'use client';
// Order details with the full tracking timeline, invoice download, cancellation and refund requests.
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { OrderActions, OrderProgress, OrderTimeline, RefundNotice, RefundPill, StatusPill } from '@/components/order-parts';
import { formatBDT } from '@/lib/products';
import { fetchOrder, paymentMethods, shippingOptions, type Order } from '@/lib/orders';

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, ready } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ready) return;
    if (!user) { setError('Please sign in to see this order.'); return; }
    fetchOrder(id).then(setOrder).catch((e) => setError(e.message));
  }, [id, user, ready]);

  return (
    <main className="inner-page">
      <Link href="/orders" className="back-link"><ChevronLeft size={16} /> All orders</Link>
      {error && <div className="cart-empty"><p>{error}</p>{!user && ready && <Link href="/login" className="button button-orange">Sign in</Link>}</div>}
      {!error && !order && null}
      {order && <Detail order={order} onChange={setOrder} />}
    </main>
  );
}

function Detail({ order: o, onChange }: { order: Order; onChange: (o: Order) => void }) {
  const st = o.status ?? 'Pending';
  const method = paymentMethods.find((p) => p.id === o.payment)?.label ?? o.payment;
  return (
    <div className="order-detail">
      <div className="page-intro" style={{ marginBottom: 0 }}>
        <span className="eyebrow">ORDER TRACKING</span>
        <h1>Order <em>#{o.id}</em></h1>
        <div className="oh-badges"><StatusPill status={st} /><RefundPill order={o} />
          <span className="muted-note" style={{ margin: 0 }}>Placed {new Date(o.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
      </div>

      <section className="order-card">
        {st === 'Cancelled' ? <div className="order-banner bad">This order was cancelled{o.cancelReason ? `: ${o.cancelReason}` : ''}.</div> : <OrderProgress status={st} />}
        <RefundNotice order={o} />
        {(o.courier || o.trackingNumber) && (
          <div className="detail-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div><span>Courier</span><b>{o.courier || '—'}</b></div>
            <div><span>Tracking number</span><b>{o.trackingNumber || '—'}</b></div>
          </div>
        )}
        <OrderActions order={o} onChange={onChange} />
        {!o.canRequestRefund && o.refundBlockReason && st === 'Delivered' && !o.refund && <small className="muted-note">{o.refundBlockReason}</small>}
      </section>

      <div className="od-grid">
        <section className="order-card">
          <h3 className="sub-h">Tracking history</h3>
          <OrderTimeline events={o.timeline ?? []} />
        </section>
        <section className="order-card">
          <h3 className="sub-h">Items</h3>
          <div className="order-items">
            {o.lines.map((l) => (
              <div key={`${l.id}-${l.name}`}>
                <span className="cart-thumb" style={{ backgroundImage: `url('${l.image}')` }} />
                <span>{l.name} × {l.quantity}</span>
                <span>{formatBDT(l.price * l.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="sum-lines">
            <div><span>Subtotal</span><b>{formatBDT(o.subtotal)}</b></div>
            {!!o.discount && <div><span>Coupon {o.coupon}</span><b>−{formatBDT(o.discount)}</b></div>}
            <div><span>Delivery</span><b>{o.delivery ? formatBDT(o.delivery) : 'Free'}</b></div>
            <div className="grand"><span>Total</span><b>{formatBDT(o.total)}</b></div>
            {o.refund?.status === 'Refunded' && <div><span>Refunded</span><b>−{formatBDT(o.refund.amount)}</b></div>}
          </div>
          <footer>
            <span>{method} · {o.paymentStatus ?? 'Unpaid'}</span>
            <span>{shippingOptions.find((s) => s.id === o.shipping)?.label}</span>
            <span>{o.address.name} · {o.address.phone}</span>
            <span>{o.address.address}, {o.address.area}, {o.address.district}</span>
          </footer>
        </section>
      </div>
    </div>
  );
}
