'use client';
// Shared order UI: status pills, tracking timeline, reason dialog and the customer's cancel / refund / invoice buttons.
import { useState } from 'react';
import { Check, Download, FileText, RotateCcw, X, XCircle } from 'lucide-react';
import { errMsg } from '@/lib/api';
import {
  cancelMyOrder, cancelReasons, downloadInvoice, refundReasons, requestRefund, statusStep, trackingSteps,
  type AdminStatus, type Order, type OrderEvent,
} from '@/lib/orders';

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

export const StatusPill = ({ status }: { status: string }) => <span className={`pill s-${status.toLowerCase()}`}>{status}</span>;

export function RefundPill({ order }: { order: Order }) {
  const r = order.refund;
  if (!r) return null;
  const label = r.status === 'Requested' ? 'Refund pending' : r.status === 'Refunded' ? (order.paymentStatus === 'Partially Refunded' ? 'Partly refunded' : 'Refunded') : 'Refund declined';
  return <span className={`pill refund-${r.status.toLowerCase()}`}>{label}</span>;
}

/* ---------- 5-step progress bar (kept from the original page) ---------- */
export function OrderProgress({ status }: { status: AdminStatus }) {
  if (status === 'Cancelled') return null;
  const step = statusStep(status);
  return (
    <ol className="track">
      {trackingSteps.map((s, i) => (
        <li key={s} className={i <= step ? 'done' : ''}>
          <span className="dot">{i <= step ? <Check size={12} /> : null}</span>{s}
        </li>
      ))}
    </ol>
  );
}

/* ---------- vertical event timeline ---------- */
export function OrderTimeline({ events, showActor = false }: { events: OrderEvent[]; showActor?: boolean }) {
  if (!events.length) return <p className="muted-note">No tracking updates yet.</p>;
  const last = events.length - 1;
  return (
    <ol className="timeline" aria-label="Order tracking timeline">
      {events.map((e, i) => (
        <li key={e.id} className={`tl-${e.kind}${i === last ? ' latest' : ''}${e.status === 'Cancelled' ? ' bad' : ''}`}>
          <span className="tl-dot" aria-hidden />
          <div>
            <b>{e.title}</b>
            {e.note && <p>{e.note}</p>}
            <small>{formatDateTime(e.at)}{showActor && e.actor !== 'system' ? ` · ${e.actor}` : ''}</small>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ---------- dialog that collects a reason (cancel / refund) ---------- */
export function ReasonDialog({ title, intro, presets, confirmLabel, backLabel = 'Keep order', danger, minLength = 3, onClose, onSubmit }: {
  title: string; intro?: string; presets?: readonly string[]; confirmLabel: string; backLabel?: string; danger?: boolean; minLength?: number;
  onClose: () => void; onSubmit: (reason: string) => Promise<void>;
}) {
  const [preset, setPreset] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const reason = [preset, text.trim()].filter(Boolean).join(' – ');
  const submit = async () => {
    if (reason.length < minLength) { setError('Please tell us the reason.'); return; }
    setBusy(true); setError('');
    try { await onSubmit(reason.slice(0, 300)); onClose(); } catch (e) { setError(errMsg(e)); setBusy(false); }
  };
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={() => !busy && onClose()}>
      <div className="modal-card small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>{title}</h2><button type="button" onClick={onClose} disabled={busy} aria-label="Close"><X size={18} /></button></div>
        {intro && <p className="muted-note" style={{ margin: 0 }}>{intro}</p>}
        {presets && <div className="reason-chips">{presets.map((p) => <button type="button" key={p} className={preset === p ? 'active' : ''} onClick={() => setPreset(preset === p ? '' : p)}>{p}</button>)}</div>}
        <label>Details {presets ? '(optional)' : ''}<textarea rows={3} maxLength={250} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add anything that helps us" /></label>
        {error && <span className="err" role="alert">{error}</span>}
        <div className="modal-foot">
          <button type="button" className="button" onClick={onClose} disabled={busy}>{backLabel}</button>
          <button type="button" className={`button ${danger ? 'danger-btn' : 'button-orange'}`} onClick={submit} disabled={busy}>{busy ? 'Please wait…' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- customer buttons: invoice, cancel, refund ---------- */
export function OrderActions({ order, onChange }: { order: Order; onChange: (o: Order) => void }) {
  const [dialog, setDialog] = useState<'cancel' | 'refund' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const invoice = async () => {
    setBusy(true); setError('');
    try { await downloadInvoice(order.id); } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <>
      <div className="order-actions">
        <button type="button" className="oa-btn" onClick={invoice} disabled={busy}><Download size={15} /> {busy ? 'Preparing…' : 'Invoice (PDF)'}</button>
        {order.canCancel && <button type="button" className="oa-btn danger" onClick={() => setDialog('cancel')}><XCircle size={15} /> Cancel order</button>}
        {order.canRequestRefund && <button type="button" className="oa-btn" onClick={() => setDialog('refund')}><RotateCcw size={15} /> Request refund</button>}
      </div>
      {error && <span className="err" role="alert">{error}</span>}
      {dialog === 'cancel' && (
        <ReasonDialog title={`Cancel order #${order.id}?`} presets={cancelReasons} confirmLabel="Cancel this order" danger
          intro={order.paymentStatus === 'Paid' ? 'Your payment will be refunded once the store processes it.' : 'Your items go back on the shelf. This cannot be undone.'}
          onClose={() => setDialog(null)} onSubmit={async (r) => onChange(await cancelMyOrder(order.id, r))} />
      )}
      {dialog === 'refund' && (
        <ReasonDialog title="Request a refund" presets={refundReasons} confirmLabel="Send request" backLabel="Back"
          intro="We'll review your request and email you the decision."
          onClose={() => setDialog(null)} onSubmit={async (r) => onChange(await requestRefund(order.id, r))} />
      )}
    </>
  );
}

export const RefundNotice = ({ order }: { order: Order }) => {
  const r = order.refund;
  if (!r) return null;
  if (r.status === 'Requested') return <div className="order-banner info"><FileText size={15} /> {r.reason === 'Order cancelled' ? 'A refund for your cancelled order is being processed.' : 'Your refund request is being reviewed.'}</div>;
  if (r.status === 'Refunded') return <div className="order-banner ok"><Check size={15} /> {`৳${r.amount.toLocaleString('en-US')} refunded via ${r.method}${r.note ? ` · ${r.note}` : ''}.`}</div>;
  return <div className="order-banner bad"><X size={15} /> Your refund request was declined{r.note ? `: ${r.note}` : '.'}</div>;
};
