'use client';
// Scoped previews. Each root sets the derived CSS variables inline, so it renders the draft theme
// independently of the theme the page itself is wearing. Only tokens are used — no hardcoded colours.
import { ShoppingBag, Search, LayoutDashboard, Package, Users, BarChart3, Heart, Bell } from 'lucide-react';
import { type Colors, deriveTokens } from '@/lib/theme';

const style = (c: Colors) => deriveTokens(c) as React.CSSProperties;

/** Small storefront thumbnail used on the preset cards. */
export function ThemeThumb({ colors }: { colors: Colors }) {
  return (
    <div className="tt" style={style(colors)} aria-hidden="true">
      <div className="tt-nav"><i /><b /><b /><b /><u /></div>
      <div className="tt-body">
        <div className="tt-hero"><span /><span /><em /></div>
        <div className="tt-grid"><div><i /><span /></div><div><i /><span /></div><div><i /><span /></div></div>
      </div>
    </div>
  );
}

const BARS = [38, 62, 48, 80, 58, 92, 70];
const LINE = '0,70 30,52 60,60 90,32 120,44 150,18 180,26';

/** Full live preview: navigation, buttons, product cards, inputs, dashboard cards, charts and sidebar. */
export function ThemePreview({ colors }: { colors: Colors }) {
  return (
    <div className="tp" style={style(colors)}>
      <div className="tp-nav">
        <strong>NEXORA</strong>
        <nav><a className="on">Home</a><a>Shop</a><a>Categories</a><a>About</a></nav>
        <div><Search size={16} /><Heart size={16} /><ShoppingBag size={16} /></div>
      </div>

      <div className="tp-layout">
        <aside className="tp-side">
          <span>Manage store</span>
          <a className="on"><LayoutDashboard size={15} /> Overview</a>
          <a><Package size={15} /> Products</a>
          <a><Users size={15} /> Customers</a>
          <a><BarChart3 size={15} /> Analytics</a>
        </aside>

        <div className="tp-main">
          <section className="tp-row">
            <button type="button" className="tp-btn primary" tabIndex={-1}>Primary</button>
            <button type="button" className="tp-btn accent" tabIndex={-1}>Accent</button>
            <button type="button" className="tp-btn outline" tabIndex={-1}>Outline</button>
            <span className="tp-chip ok">Delivered</span>
            <span className="tp-chip warn">Pending</span>
            <span className="tp-chip bad">Cancelled</span>
          </section>

          <section className="tp-kpis">
            {[['Revenue', '৳ 482,300', '+12.4%'], ['Orders', '1,284', '+6.1%'], ['Customers', '842', '+3.8%']].map(([l, v, d]) => (
              <div key={l} className="tp-card"><small>{l}</small><strong>{v}</strong><em>{d}</em></div>
            ))}
          </section>

          <section className="tp-grid2">
            <div className="tp-card">
              <small>Sales this week</small>
              <svg viewBox="0 0 180 80" className="tp-chart" role="img" aria-label="Sales line chart preview" preserveAspectRatio="none">
                <line x1="0" y1="20" x2="180" y2="20" /><line x1="0" y1="45" x2="180" y2="45" /><line x1="0" y1="70" x2="180" y2="70" />
                <polyline points={LINE} fill="none" className="l1" /><polyline points="0,74 30,66 60,70 90,50 120,58 150,40 180,46" fill="none" className="l2" />
              </svg>
              <div className="tp-bars" aria-hidden="true">{BARS.map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div>
            </div>
            <div className="tp-card">
              <small>Recent orders</small>
              <table className="tp-table"><tbody>
                <tr><td>#1042</td><td>Aisha K.</td><td><span className="tp-chip ok">Paid</span></td></tr>
                <tr><td>#1041</td><td>Rahim U.</td><td><span className="tp-chip warn">Pending</span></td></tr>
                <tr><td>#1040</td><td>Nadia S.</td><td><span className="tp-chip ok">Paid</span></td></tr>
              </tbody></table>
              <label className="tp-field"><span>Search orders</span><input readOnly tabIndex={-1} placeholder="Order ID or name" /></label>
            </div>
          </section>

          <section className="tp-products">
            {[['Aero Headphones', '৳ 8,900'], ['Nova Smartwatch', '৳ 12,500']].map(([n, p], i) => (
              <article key={n} className="tp-product">
                <div className="tp-img">{i === 0 && <span className="tp-chip bad">-15%</span>}</div>
                <h4>{n}</h4><p>{p}</p>
                <button type="button" className="tp-btn primary full" tabIndex={-1}><ShoppingBag size={14} /> Add to bag</button>
              </article>
            ))}
            <div className="tp-modal">
              <div className="tp-modal-head"><b>Confirm order</b><Bell size={14} /></div>
              <p>Your bag has 2 items ready for checkout.</p>
              <label className="tp-field"><span>Email</span><input readOnly tabIndex={-1} defaultValue="you@example.com" /></label>
              <div className="tp-row"><button type="button" className="tp-btn outline" tabIndex={-1}>Cancel</button><button type="button" className="tp-btn accent" tabIndex={-1}>Confirm</button></div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
