'use client';
import { useEffect, useState } from 'react';
import { Search, Eye, X, Download, Mail, Truck } from 'lucide-react';
import { formatBDT } from '@/lib/products';
import { errMsg } from '@/lib/api';
import { useAdminOrders, orderStatuses, formatDate, type AdminOrder, type EmailLogRow, type OrderStatus } from '@/lib/admin-data';
import { downloadInvoice } from '@/lib/orders';
import { OrderTimeline, ReasonDialog, RefundPill, formatDateTime } from '@/components/order-parts';

const ADMIN_CANCEL_REASONS = ['Out of stock', 'Customer asked to cancel', 'Could not reach customer', 'Payment problem', 'Suspected fake order'] as const;
const COURIERS = ['Pathao', 'RedX', 'Steadfast', 'Paperfly', 'Sundarban', 'eCourier'];
const REFUND_METHODS = ['bKash', 'Nagad', 'Bank transfer', 'Card (SSLCommerz)', 'Cash'];
const methodFor = (payment: string) => (/bkash/i.test(payment) ? 'bKash' : /nagad/i.test(payment) ? 'Nagad' : /ssl/i.test(payment) ? 'Card (SSLCommerz)' : 'Cash');

function StatusSelect({ value, onChange, label }: { value: OrderStatus; onChange: (s: OrderStatus) => void; label: string }) {
  return (
    <select className={`status-select s-${value.toLowerCase()}`} aria-label={label} value={value} onChange={(e) => onChange(e.target.value as OrderStatus)}>
      {orderStatuses.map((s) => <option key={s}>{s}</option>)}
    </select>
  );
}

type Api = ReturnType<typeof useAdminOrders>;

/* courier + tracking number, asked when an order is marked as shipped */
function ShipDialog({ order, onClose, onSubmit }: { order: AdminOrder; onClose: () => void; onSubmit: (x: { courier: string; trackingNumber: string }) => Promise<void> }) {
  const [courier, setCourier] = useState(order.full.courier ?? '');
  const [tracking, setTracking] = useState(order.full.trackingNumber ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const go = async () => {
    setBusy(true); setError('');
    try { await onSubmit({ courier, trackingNumber: tracking }); onClose(); } catch (e) { setError(errMsg(e)); setBusy(false); }
  };
  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={() => !busy && onClose()}>
      <div className="modal-card small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>Ship order #{order.id}</h2><button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <p className="muted-note" style={{ margin: 0 }}>The customer sees these details in their tracking timeline and e-mail.</p>
        <label>Courier<input list="couriers" value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="e.g. Pathao" /></label>
        <datalist id="couriers">{COURIERS.map((c) => <option key={c} value={c} />)}</datalist>
        <label>Tracking number (optional)<input value={tracking} onChange={(e) => setTracking(e.target.value)} /></label>
        {error && <span className="err" role="alert">{error}</span>}
        <div className="modal-foot"><button type="button" className="button" onClick={onClose} disabled={busy}>Back</button><button type="button" className="button button-orange" onClick={go} disabled={busy}><Truck size={15} /> {busy ? 'Saving…' : 'Mark as shipped'}</button></div>
      </div>
    </div>
  );
}

/* refund handling: process a request, decline it, or issue a refund directly */
function RefundPanel({ o, api, onError }: { o: AdminOrder; api: Api; onError: (m: string) => void }) {
  const f = o.full;
  const r = f.refund;
  const [amount, setAmount] = useState(String(o.total));
  const [method, setMethod] = useState(methodFor(o.payment));
  const [note, setNote] = useState('');
  const [restock, setRestock] = useState(false);
  const [open, setOpen] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => { setBusy(true); onError(''); try { await fn(); setOpen(false); } catch (e) { onError(errMsg(e)); } finally { setBusy(false); } };

  if (r?.status === 'Refunded')
    return <div className="panel-box"><h4>Refund</h4><div className="row"><b>{formatBDT(r.amount)} via {r.method}</b><RefundPill order={f} /></div>{r.note && <small className="sub">{r.note}</small>}<small className="sub">{r.refundedAt && formatDateTime(r.refundedAt)}</small></div>;
  if (r?.status === 'Rejected')
    return <div className="panel-box"><h4>Refund</h4><div className="row"><b>Request declined</b><RefundPill order={f} /></div><small className="sub">Customer reason: {r.reason}</small>{r.note && <small className="sub">Your note: {r.note}</small>}</div>;
  if (!r && f.paymentStatus !== 'Paid') return <div className="panel-box"><h4>Refund</h4><small className="sub">Nothing to refund until the order is paid.</small></div>;

  const form = (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="field-row">
        <label>Amount (৳)<input type="number" min={1} max={o.total} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        <label>Refunded via<select value={method} onChange={(e) => setMethod(e.target.value)}>{REFUND_METHODS.map((m) => <option key={m}>{m}</option>)}</select></label>
      </div>
      <label>Note to customer (optional)<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. bKash TrxID or account used" /></label>
      {o.status !== 'Cancelled' && <label className="check"><input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} /> Returned items go back into stock</label>}
      <div className="modal-foot">
        <button type="button" className="button" onClick={() => setOpen(false)} disabled={busy}>Back</button>
        <button type="button" className="button button-orange" disabled={busy || !(Number(amount) > 0)}
          onClick={() => run(() => api.refund(o.id, { amount: Math.round(Number(amount)), method, note: note.trim() || undefined, restock }))}>{busy ? 'Saving…' : 'Confirm refund'}</button>
      </div>
    </div>
  );

  return (
    <div className={`panel-box${r ? ' alert' : ''}`}>
      <h4>Refund</h4>
      {r ? <div className="row"><b>{r.reason === 'Order cancelled' ? 'Refund due (order cancelled)' : 'Customer requested a refund'}</b><RefundPill order={f} /></div> : <small className="sub">Paid {formatBDT(o.total)}. Refund the customer if needed.</small>}
      {r && r.reason !== 'Order cancelled' && <small className="sub">“{r.reason}”</small>}
      {open ? form : (
        <div className="row">
          <button type="button" className="oa-btn primary" onClick={() => setOpen(true)}>{r ? 'Process refund' : 'Issue refund'}</button>
          {r && o.status !== 'Cancelled' && <button type="button" className="oa-btn danger" onClick={() => setDeclining(true)}>Decline</button>}
        </div>
      )}
      {declining && <ReasonDialog title="Decline refund request" intro="The customer will see this reason by e-mail." confirmLabel="Decline request" backLabel="Back" danger minLength={3}
        onClose={() => setDeclining(false)} onSubmit={(reason) => api.rejectRefund(o.id, reason)} />}
    </div>
  );
}

function OrderModal({ o, api, onClose, requestStatus }: { o: AdminOrder; api: Api; onClose: () => void; requestStatus: (o: AdminOrder, s: OrderStatus) => void }) {
  const f = o.full;
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [mails, setMails] = useState<EmailLogRow[] | null>(null);
  const loadMails = () => api.emails(o.id).then(setMails).catch(() => setMails([]));
  // reload the e-mail log when the order changes (each change queues an e-mail in the background)
  useEffect(() => { loadMails(); const t = setTimeout(loadMails, 2500); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [o.id, f.timeline?.length]);
  const act = async (fn: () => Promise<unknown>, ok?: string) => { setError(''); setNote(''); try { await fn(); if (ok) setNote(ok); } catch (e) { setError(errMsg(e)); } };

  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>Order #{o.id}</h2><button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <div className="detail-grid">
          <div><span>Customer</span><b>{o.customer}</b><small>{o.phone}</small><small>{o.email}</small></div>
          <div><span>Ship to</span><b>{o.address}</b>{(f.courier || f.trackingNumber) && <small>{[f.courier, f.trackingNumber && `Tracking ${f.trackingNumber}`].filter(Boolean).join(' · ')}</small>}</div>
          <div><span>Placed</span><b>{formatDate(o.date)}</b><small>Payment: {o.payment} · {f.paymentStatus ?? 'Unpaid'}</small></div>
          <div><span>Status</span><StatusSelect value={o.status} onChange={(s) => requestStatus(o, s)} label="Change status" />{f.cancelReason && <small>Reason: {f.cancelReason} ({f.cancelledBy})</small>}</div>
        </div>
        {error && <div className="order-banner bad" role="alert">{error}</div>}
        {note && <div className="order-banner ok">{note}</div>}

        <div className="od-admin">
          <div style={{ display: 'grid', gap: 14 }}>
            <div className="table-scroll">
              <table className="inv-table" style={{ minWidth: 0 }}>
                <thead><tr><th>Item</th><th>Qty</th><th style={{ textAlign: 'right' }}>Line total</th></tr></thead>
                <tbody>{o.items.map((i) => <tr key={i.name}><td>{i.name}</td><td>{i.qty}</td><td style={{ textAlign: 'right' }}>{formatBDT(i.price * i.qty)}</td></tr>)}</tbody>
              </table>
            </div>
            <div className="sum-lines">
              {!!o.discount && <div><span>Coupon {o.coupon}</span><b>−{formatBDT(o.discount)}</b></div>}
              <div><span>Delivery</span><b>{o.delivery ? formatBDT(o.delivery) : 'Free'}</b></div>
              <div className="grand"><span>Total</span><b>{formatBDT(o.total)}</b></div>
            </div>

            <div className="panel-box">
              <h4>Payment</h4>
              <div className="row">
                <span className={`pill pay-${(f.paymentStatus ?? 'Unpaid').toLowerCase().replace(' ', '-')}`}>{f.paymentStatus ?? 'Unpaid'}</span>
                {(f.paymentStatus === 'Unpaid' || f.paymentStatus === 'Paid' || f.paymentStatus === 'pending_verification') && o.status !== 'Cancelled' && (
                  <button type="button" className="oa-btn" onClick={() => act(() => api.setPaid(o.id, f.paymentStatus !== 'Paid'))}>{f.paymentStatus === 'Paid' ? 'Mark as unpaid' : f.paymentStatus === 'pending_verification' ? 'Verify & mark paid' : 'Mark as paid'}</button>
                )}
              </div>
              {f.paymentInfo && <div className="sub" style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                <small>Demo payment reference: {String(f.paymentInfo.trx_id ?? '—')}</small>
                {f.paymentInfo.sender_number && <small>Sender number: {String(f.paymentInfo.sender_number)}</small>}
                <small>Channel: {String(f.paymentInfo.payment_method ?? f.paymentInfo.method ?? o.payment)}</small>
                <small>Reminder: this is a dummy channel. Verify the transaction externally before marking paid.</small>
              </div>}
            </div>
            <RefundPanel o={o} api={api} onError={setError} />
            <div className="order-actions">
              <button type="button" className="oa-btn" onClick={() => act(() => downloadInvoice(o.id))}><Download size={15} /> Invoice PDF</button>
              <button type="button" className="oa-btn" disabled={o.email === '—'} onClick={() => act(async () => { const r = await api.emailInvoice(o.id); setTimeout(loadMails, 1500); return r; }, `Invoice is being e-mailed to ${o.email}.`)}><Mail size={15} /> E-mail invoice</button>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            <div className="panel-box"><h4>Tracking timeline</h4><OrderTimeline events={f.timeline ?? []} showActor /></div>
            <div className="panel-box">
              <h4>E-mail log</h4>
              {mails === null ? <small className="sub">Loading…</small> : mails.length === 0 ? <small className="sub">No e-mails yet.</small> : (
                <div className="email-log">
                  {mails.map((m) => (
                    <div key={m.id} title={m.error ?? m.subject}><span>{m.kind.replace(/_/g, ' ')} → {m.to}<small className="sub">{formatDateTime(m.at)}</small></span><span className={`pill mail-${m.status}`}>{m.status}</span></div>
                  ))}
                </div>
              )}
              {mails?.some((m) => m.status === 'logged') && <small className="sub">“logged” = SMTP is not configured, so the e-mail was recorded but not delivered. Set SMTP_* in backend/.env to send.</small>}
            </div>
          </div>
        </div>
        <div className="modal-foot"><button className="button" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

export default function OrderManagement() {
  const api = useAdminOrders();
  const { orders, setStatus: saveStatus } = api;
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'All' | OrderStatus | 'Refunds'>('All');
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ order: AdminOrder; status: 'Cancelled' | 'Shipped' } | null>(null);
  const [toast, setToast] = useState('');
  const open: AdminOrder | undefined = orders.find((o) => o.id === openId);

  const apply = (id: string, s: OrderStatus, extra = {}) => saveStatus(id, s, extra);
  const requestStatus = (o: AdminOrder, s: OrderStatus) => {
    if (s === o.status) return;
    // cancelling needs a reason and shipping asks for the courier; everything else is a single click
    if (s === 'Cancelled' || s === 'Shipped') setPending({ order: o, status: s });
    else apply(o.id, s).catch((e) => setToast(errMsg(e)));
  };

  const refundOpen = (o: AdminOrder) => o.full.refund?.status === 'Requested';
  const shown = orders.filter((o) => (filter === 'All' || (filter === 'Refunds' ? !!o.full.refund : o.status === filter)) && (o.id + o.customer + o.phone).toLowerCase().includes(q.trim().toLowerCase()));
  const n = (s: OrderStatus) => orders.filter((o) => o.status === s).length;
  const summary = [['All orders', String(orders.length), 'All placed orders'], ['Pending', String(n('Pending')), 'Need confirmation'], ['In progress', String(n('Confirmed') + n('Processing') + n('Shipped')), 'Being fulfilled'], ['Delivered', String(n('Delivered')), 'Completed'], ['Refund requests', String(orders.filter(refundOpen).length), 'Waiting for you']];

  return (
    <main className="inner-page admin-page">
      <div className="page-intro">
        <span className="eyebrow">NEXORA / ORDERS</span>
        <h1>Order <em>management.</em></h1>
        <p>Update status, add courier tracking, cancel with a reason and handle refunds. Every change is saved to the order timeline the customer sees in “My orders” and triggers an e-mail. Cancelling puts items (and the coupon use) back.</p>
      </div>
      {toast && <div className="order-banner bad" role="alert" onClick={() => setToast('')} style={{ cursor: 'pointer' }}>{toast}</div>}
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>{summary.map(([a, b, c]) => <div className="stat-card" key={a}><span>{a}</span><strong>{b}</strong><small>{c}</small></div>)}</div>

      <div className="admin-preview">
        <div className="inv-tools">
          <label className="inv-search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by order ID, name or phone" /></label>
          <div className="inv-filters">{(['All', ...orderStatuses, 'Refunds'] as const).map((f) => <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{f}</button>)}</div>
        </div>
        <div className="table-scroll">
          <table className="inv-table" style={{ minWidth: 860 }}>
            <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Payment</th><th>Status</th><th style={{ textAlign: 'right' }}>Details</th></tr></thead>
            <tbody>
              {shown.map((o) => (
                <tr key={o.id}>
                  <td><b>#{o.id}</b></td>
                  <td><div><b>{o.customer}</b><small className="sub">{o.phone}</small></div></td>
                  <td>{formatDate(o.date)}</td>
                  <td>{formatBDT(o.total)}</td>
                  <td><span className={`pill pay-${(o.full.paymentStatus ?? 'Unpaid').toLowerCase().replace(' ', '-')}`}>{o.full.paymentStatus ?? 'Unpaid'}</span>{o.full.refund && <> <RefundPill order={o.full} /></>}</td>
                  <td><StatusSelect value={o.status} onChange={(s) => requestStatus(o, s)} label={`Status of order ${o.id}`} /></td>
                  <td><div className="row-actions"><button onClick={() => setOpenId(o.id)}><Eye size={15} /> View</button></div></td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={7} className="muted-note">No orders match.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {open && <OrderModal o={open} api={api} onClose={() => setOpenId(null)} requestStatus={requestStatus} />}
      {pending?.status === 'Cancelled' && (
        <ReasonDialog title={`Cancel order #${pending.order.id}?`} presets={ADMIN_CANCEL_REASONS} confirmLabel="Cancel order" danger
          intro={pending.order.full.paymentStatus === 'Paid' ? 'This order is paid - a refund will be marked as due. Items go back in stock.' : 'Items go back in stock and the customer is e-mailed.'}
          onClose={() => setPending(null)} onSubmit={(reason) => apply(pending.order.id, 'Cancelled', { note: reason })} />
      )}
      {pending?.status === 'Shipped' && <ShipDialog order={pending.order} onClose={() => setPending(null)} onSubmit={(x) => apply(pending.order.id, 'Shipped', x)} />}
    </main>
  );
}
