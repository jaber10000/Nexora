'use client';
import { useState } from 'react';
import { Plus, Pencil, Trash2, X, Copy } from 'lucide-react';
import { formatBDT } from '@/lib/products';
import { errMsg } from '@/lib/api';
import { useCoupons, formatDate, type Coupon } from '@/lib/admin-data';

type Form = { id?: number; code: string; type: Coupon['type']; value: string; minOrder: string; limit: string; expires: string; active: boolean };
const empty: Form = { code: '', type: 'percent', value: '', minOrder: '0', limit: '100', expires: '', active: true };
const toForm = (c: Coupon): Form => ({ id: c.id, code: c.code, type: c.type, value: String(c.value), minOrder: String(c.minOrder), limit: String(c.limit), expires: c.expires, active: c.active });
const label = (c: Coupon) => (c.type === 'percent' ? `${c.value}% off` : `${formatBDT(c.value)} off`);

export default function CouponManagement() {
  const { coupons, save, remove } = useCoupons();
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toDelete, setToDelete] = useState<Coupon | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const close = () => { setForm(null); setErrors({}); };
  const expired = (c: Coupon) => !!c.expires && new Date(c.expires) < new Date(new Date().toDateString());
  const state = (c: Coupon) => (!c.active ? 'Inactive' : expired(c) ? 'Expired' : c.used >= c.limit ? 'Used up' : 'Active');
  const live = coupons.filter((c) => state(c) === 'Active').length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const code = form.code.trim().toUpperCase().replace(/\s+/g, ''), value = Number(form.value), minOrder = Number(form.minOrder) || 0, limit = Number(form.limit);
    const err: Record<string, string> = {};
    if (!/^[A-Z0-9_-]{3,20}$/.test(code)) err.code = 'Use 3–20 letters, numbers, - or _.';
    else if (coupons.some((c) => c.id !== form.id && c.code === code)) err.code = 'This code already exists.';
    if (!(value > 0) || (form.type === 'percent' && value > 100)) err.value = form.type === 'percent' ? 'Enter 1–100.' : 'Enter an amount above 0.';
    if (!(limit >= 1) || !Number.isInteger(limit)) err.limit = 'Enter a whole number, 1 or more.';
    if (!form.expires) err.expires = 'Choose an expiry date.';
    setErrors(err);
    if (Object.keys(err).length) return;
    const base = { code, type: form.type, value, minOrder, limit, expires: form.expires, active: form.active };
    try { await save({ id: form.id, ...base }); close(); } catch (e) { setErrors({ code: errMsg(e) }); }
  }

  return (
    <main className="inner-page admin-page">
      <div className="page-intro">
        <span className="eyebrow">NEXORA / COUPONS</span>
        <h1>Coupon <em>management.</em></h1>
        <p>Create and edit discount codes. Saved in this browser only (demo) — checkout doesn’t apply them yet.</p>
      </div>
      <div className="stats-grid">
        {[['Total codes', String(coupons.length), 'All coupons'], ['Active now', String(live), 'Usable at checkout'], ['Redemptions', String(coupons.reduce((n, c) => n + c.used, 0)), 'All time']].map(([a, b, c]) => <div className="stat-card" key={a}><span>{a}</span><strong>{b}</strong><small>{c}</small></div>)}
      </div>

      <div className="admin-preview">
        <div className="inv-tools"><span className="muted-note" style={{ flex: 1, padding: 0 }}>Discount codes</span><button className="button button-orange" onClick={() => setForm(empty)}><Plus size={16} /> Create coupon</button></div>
        <div className="table-scroll">
          <table className="inv-table" style={{ minWidth: 760 }}>
            <thead><tr><th>Code</th><th>Discount</th><th>Min. order</th><th>Used</th><th>Expires</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id}>
                  <td><span className="coupon-code">{c.code}</span></td><td>{label(c)}</td><td>{c.minOrder ? formatBDT(c.minOrder) : 'None'}</td>
                  <td>{c.used} / {c.limit}</td><td>{formatDate(c.expires)}</td>
                  <td><span className={`pill ${state(c) === 'Active' ? 'in' : state(c) === 'Inactive' ? 'off' : 'out'}`}>{state(c)}</span></td>
                  <td><div className="row-actions">
                    <button onClick={() => save({ ...c, active: !c.active }).catch((e) => alert(errMsg(e)))}>{c.active ? 'Disable' : 'Enable'}</button>
                    <button onClick={() => setForm(toForm(c))}><Pencil size={15} /> Edit</button>
                    <button className="danger" onClick={() => setToDelete(c)}><Trash2 size={15} /> Delete</button>
                  </div></td>
                </tr>
              ))}
              {coupons.length === 0 && <tr><td colSpan={7} className="muted-note">No coupons yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <div className="modal" role="dialog" aria-modal="true" onClick={close}>
          <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={submit} noValidate>
            <div className="modal-head"><h2>{form.id ? 'Edit coupon' : 'Create coupon'}</h2><button type="button" onClick={close} aria-label="Close"><X size={18} /></button></div>
            <div className="field-grid">
              <label>Coupon code
                <span className="inline-field"><input value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="SAVE10" />
                  <button type="button" className="button" onClick={() => set('code', 'NX' + Math.random().toString(36).slice(2, 8).toUpperCase())} title="Generate"><Copy size={14} /> Generate</button></span>
                {errors.code && <small className="err">{errors.code}</small>}</label>
              <label>Discount type<select value={form.type} onChange={(e) => set('type', e.target.value as Coupon['type'])}><option value="percent">Percentage (%)</option><option value="fixed">Fixed amount (৳)</option></select></label>
              <label>{form.type === 'percent' ? 'Percent off' : 'Amount off (৳)'}<input type="number" min={0} value={form.value} onChange={(e) => set('value', e.target.value)} />{errors.value && <small className="err">{errors.value}</small>}</label>
              <label>Minimum order (৳)<input type="number" min={0} value={form.minOrder} onChange={(e) => set('minOrder', e.target.value)} /></label>
              <label>Usage limit<input type="number" min={1} value={form.limit} onChange={(e) => set('limit', e.target.value)} />{errors.limit && <small className="err">{errors.limit}</small>}</label>
              <label>Expiry date<input type="date" value={form.expires} onChange={(e) => set('expires', e.target.value)} />{errors.expires && <small className="err">{errors.expires}</small>}</label>
            </div>
            <label className="check"><input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} /> Coupon is active</label>
            <div className="modal-foot"><button type="button" className="button" onClick={close}>Cancel</button><button className="button button-orange" type="submit">{form.id ? 'Save changes' : 'Create coupon'}</button></div>
          </form>
        </div>
      )}

      {toDelete && (
        <div className="modal" role="alertdialog" aria-modal="true" onClick={() => setToDelete(null)}>
          <div className="modal-card small" onClick={(e) => e.stopPropagation()}>
            <h2>Delete coupon?</h2>
            <p className="muted-note">Code <b>{toDelete.code}</b> will stop working. This can’t be undone.</p>
            <div className="modal-foot"><button className="button" onClick={() => setToDelete(null)}>Keep it</button><button className="button danger-btn" onClick={async () => { try { await remove(toDelete.id); } catch (e) { alert(errMsg(e)); } setToDelete(null); }}>Delete</button></div>
          </div>
        </div>
      )}
    </main>
  );
}
