
'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchLoyaltyBalance,
  fetchLoyaltyOffers,
  fetchLoyaltyHistory,
  redeemLoyaltyPoints,
  type LoyaltyBalance,
  type LoyaltyOffer,
  type LoyaltyTransaction,
} from '@/lib/engagement';
import { formatBDT } from '@/lib/products';
import { api } from '@/lib/api';

const tierIcons: Record<string, string> = {
  Bronze: '🥉',
  Silver: '🥈',
  Platinum: '💎',
  Diamond: '👑',
  'Gold Elite': '🥇',
};

export function LoyaltyDashboard() {
  const [balance, setBalance] = useState<LoyaltyBalance | null>(null);
  const [offers, setOffers] = useState<LoyaltyOffer[]>([]);
  const [history, setHistory] = useState<LoyaltyTransaction[]>([]);
  const [points, setPoints] = useState('100');
  const [message, setMessage] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [coupons, setCoupons] = useState<{code:string;tier:string;redeemed:boolean;expires?:string|null;coupon_type?:string|null;coupon_value?:number|null}[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(async () => {
    const [b, o, h] = await Promise.all([
      fetchLoyaltyBalance(),
      fetchLoyaltyOffers(),
      fetchLoyaltyHistory(),
    ]);

    setBalance(b);
    setOffers(Array.isArray(o) ? o : []);
    setHistory(Array.isArray(h) ? h : []);
    const c = await api<{items:typeof coupons}>('/api/loyalty/coupons');
    setCoupons(c.items || []);
  }, []);

  useEffect(() => {
    const refresh = () => loadData().catch((e) => setError(e.message || 'Could not load loyalty information.'));
    void refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(refresh, 30000);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', onVisible); window.clearInterval(timer); };
  }, [loadData]);

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    setError('');

    const amount = Number(points);
    if (!Number.isInteger(amount) || amount <= 0) {
      setError('Enter a valid points amount.');
      return;
    }

    setBusy(true);
    try {
      const result = await redeemLoyaltyPoints(amount);
      const r = result as { discount_amount?: number; coupon_code?: string };
      setCouponCode(r.coupon_code || '');
      setMessage(`Points redeemed. Discount value: ${formatBDT(Number(r.discount_amount ?? 0))}. Use the generated coupon at checkout.`);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not redeem points.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="checkout-card loyalty-dashboard">
      <span className="eyebrow">NEXORA REWARDS</span>
      <h2>Your Loyalty <em>Rewards.</em></h2>

      {error && <p className="err" role="alert">{error}</p>}
      {message && <p className="success-note" role="status">{message}</p>}

      {!balance ? (
        <p className="muted-note">Loading loyalty account…</p>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <span>Available points</span>
              <strong>{balance.points_balance}</strong>
              <small>Ready to redeem</small>
            </div>
            <div className="stat-card">
              <span>Lifetime points</span>
              <strong>{balance.lifetime_points}</strong>
              <small>Never decrease</small>
            </div>
            <div className="stat-card">
              <span>Current tier</span>
              <strong>
                {tierIcons[balance.current_tier || balance.tier || ''] || '⭐'}{' '}
                {balance.current_tier || balance.tier || 'Member'}
              </strong>
              <small>Your membership level</small>
            </div>
          </div>

          {balance.free_delivery_until && <p className="success-note">Platinum free delivery active until {new Date(balance.free_delivery_until).toLocaleDateString()}.</p>}
          {balance.lifetime_points >= 2500 && <p className="success-note">Gold Elite free delivery is active on your orders.</p>}
          <h3 className="loyalty-subtitle">Membership milestones</h3>
          <div className="loyalty-tier-list">
            {offers.map((offer) => (
              <article className="loyalty-tier" key={offer.tier}>
                <div>
                  <strong>
                    {tierIcons[offer.tier] || '⭐'} {offer.tier}
                  </strong>
                  <small>{offer.required_points.toLocaleString()} lifetime points</small>
                  <ul>
                    {offer.benefits.map((benefit) => (
                      <li key={benefit}>{benefit}</li>
                    ))}
                  </ul>
                </div>
                <span className={`pill ${offer.unlocked ? 'in' : 'low'}`}>
                  {offer.unlocked
                    ? 'Unlocked'
                    : `${offer.remaining_points ?? 0} points left`}
                </span>
              </article>
            ))}
          </div>

          <h3 className="loyalty-subtitle">Redeem points</h3>
          <form className="loyalty-redeem" onSubmit={handleRedeem}>
            <label>
              Points to redeem
              <input
                type="number"
                min="1"
                max={balance.points_balance}
                step="1"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
              />
            </label>
            <button
              className="button button-orange"
              type="submit"
              disabled={busy || balance.points_balance <= 0}
            >
              {busy ? 'Processing…' : 'Redeem points'}
            </button>
          </form>
          <small className="muted-note">
            The redeemable discount is calculated by the backend. Confirm that it is
            applied to your checkout before placing an order.
          </small>

          {couponCode && <div className="success-note" style={{margin:'12px 0'}}>New coupon code: <strong>{couponCode}</strong> <button type="button" onClick={()=>navigator.clipboard?.writeText(couponCode)}>Copy</button></div>}
          <h3 className="loyalty-subtitle">Your reward coupons</h3>
          {coupons.length===0?<p className="muted-note">Coupons unlock as you reach loyalty tiers or redeem points.</p>:<div className="loyalty-history">{coupons.map(c=><div className="order-line" key={c.code}><span><b>{c.code}</b><small>{c.tier}{c.coupon_type==='percent'&&c.coupon_value?` · ${c.coupon_value}% off`:c.coupon_type==='fixed'&&c.coupon_value?` · ${formatBDT(c.coupon_value)} off`:''}{c.expires?` · Expires ${c.expires}`:''}</small></span><strong>{c.redeemed?'Used':'Available'}</strong></div>)}</div>}
          <h3 className="loyalty-subtitle">Points history</h3>
          {history.length === 0 ? (
            <p className="muted-note">No loyalty transactions yet.</p>
          ) : (
            <div className="loyalty-history">
              {history.map((item) => (
                <div className="order-line" key={item.id}>
                  <span>
                    <b>{item.description || item.transaction_type}</b>
                    <small>
                      {new Date(item.created_at).toLocaleDateString()}
                      {item.order_id ? ` · Order #${item.order_id}` : ''}
                    </small>
                  </span>
                  <strong className={item.points >= 0 ? 'loyalty-earned' : 'err'}>
                    {item.points > 0 ? '+' : ''}{item.points} pts
                  </strong>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
