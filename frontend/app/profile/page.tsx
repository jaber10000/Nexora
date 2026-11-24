'use client';
// Profile page for both roles. Customers see their orders; administrators see store shortcuts and live figures.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, LogOut, Package, ShieldCheck, Heart, ClipboardList, PackagePlus, Boxes, Ticket, ShoppingBag, Truck, Wallet, Users, TrendingUp, UserRound, KeyRound, Mail, Phone, CalendarDays, ChevronRight, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { useStore } from '@/components/store-provider';
import { PasswordField } from '@/components/password-field';
import { formatBDT } from '@/lib/products';
import { fetchMyOrders, type Order } from '@/lib/orders';
import { useCatalog } from '@/lib/catalog';
import { stockStatus } from '@/lib/stock';
import { useAdminOrders, useStats, formatDate } from '@/lib/admin-data';
import { LoyaltyDashboard } from '@/components/loyalty-dashboard';


const initials = (name: string) => name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
const statusClass = (s: string) => `pill s-${s.toLowerCase()}`;

function StatTiles({ items, ready = true }: { items: [string, string, string, LucideIcon][]; ready?: boolean }) {
  return (
    <div className="stats-grid pf-stats">
      {items.map(([label, value, hint, Icon]) => (
        <div className="stat-card pf-stat" key={label}>
          <span className="pf-stat-icon"><Icon size={20} /></span>
          <span>{label}</span>
          <strong>{ready ? value : '…'}</strong>
          <small>{hint}</small>
        </div>
      ))}
    </div>
  );
}

function Tile({ href, label, Icon, primary }: { href: string; label: string; Icon: LucideIcon; primary?: boolean }) {
  return (
    <Link href={href} className={`pf-tile${primary ? ' primary' : ''}`}>
      <span className="pf-tile-icon"><Icon size={20} /></span>
      <b>{label}</b>
      <ChevronRight size={16} className="pf-tile-go" />
    </Link>
  );
}

/* ---------- customer summary ---------- */
function CustomerSummary() {
  const { wishlist } = useStore();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { fetchMyOrders().then(setOrders).catch((e) => { setError(e.message); setOrders([]); }); }, []);

  const list = orders ?? [];
  const active = list.filter((o) => !['Delivered', 'Cancelled'].includes(o.status ?? 'Pending')).length;
  const spent = list.filter((o) => o.status !== 'Cancelled').reduce((n, o) => n + o.total, 0);
  const stats: [string, string, string, LucideIcon][] = [['Orders', String(list.length), 'All time', ShoppingBag], ['In progress', String(active), 'On the way to you', Truck], ['Total spent', formatBDT(spent), 'Excluding cancelled', Wallet], ['Wishlist', String(wishlist.length), 'Saved items', Heart]];
  return (
    <>
      <StatTiles items={stats} ready={orders !== null} />
      <div className="pf-tiles"><Tile href="/orders" label="All orders" Icon={Package} /><Tile href="/wishlist" label="Wishlist" Icon={Heart} /><Tile href="/products" label="Continue shopping" Icon={ShoppingBag} primary /></div>
      <section className="checkout-card">
        <h2><Package size={18} /> Recent orders</h2>
        {error && <small className="err" role="alert">{error}</small>}
        {orders !== null && list.length === 0 && !error && <p className="muted-note" style={{ padding: 0 }}>You haven’t placed an order yet.</p>}
        {list.slice(0, 3).map((o) => (
          <div className="order-line" key={o.id}><span>#{o.id} · {formatDate(o.createdAt)}</span><b>{formatBDT(o.total)}</b><small className={statusClass(o.status ?? 'Pending')}>{o.status ?? 'Pending'}</small></div>
        ))}
      </section>
      <LoyaltyDashboard />
    </>
  );
}

/* ---------- admin summary ---------- */
function AdminSummary() {
  const { value: st, ready, error } = useStats();
  const { orders } = useAdminOrders();
  const { items } = useCatalog();
  const pending = orders.filter((o) => o.status === 'Pending').length;
  const lowStock = items.filter((p) => stockStatus(p.stock ?? 0) !== 'in').length;
  const stats: [string, string, string, LucideIcon][] = [['Total sales', formatBDT(st.sales), 'Excluding cancelled', TrendingUp], ['Orders', String(st.orders), `${pending} pending`, ClipboardList], ['Products', String(items.length), `${lowStock} low or out of stock`, Boxes], ['Customers', String(st.customers), 'Unique buyers', Users]];
  const shortcuts = [['/admin/orders', 'Orders', ClipboardList], ['/admin/products', 'Products', PackagePlus], ['/admin/inventory', 'Inventory', Boxes], ['/admin/coupons', 'Coupons', Ticket]] as const;
  return (
    <>
      {error && <small className="err" role="alert">{error}</small>}
      <StatTiles items={stats} ready={ready} />
      <div className="pf-tiles">
        {shortcuts.map(([href, label, Icon]) => <Tile key={href} href={href} label={label} Icon={Icon} />)}
        <Tile href="/admin" label="Open dashboard" Icon={ShieldCheck} primary />
      </div>
      <section className="checkout-card">
        <h2><ClipboardList size={18} /> Latest orders</h2>
        {orders.length === 0 && <p className="muted-note" style={{ padding: 0 }}>No orders yet.</p>}
        {orders.slice(0, 4).map((o) => <div className="order-line" key={o.id}><span>#{o.id} · {o.customer}</span><b>{formatBDT(o.total)}</b><small className={statusClass(o.status)}>{o.status}</small></div>)}
      </section>
      <LoyaltyDashboard />
    </>
  );
}


/* ---------- forms ---------- */
function DetailsForm() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [errors, setErrors] = useState<{ name?: string; phone?: string; form?: string }>({});
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  const dirty = name.trim() !== user.name || phone.trim() !== user.phone;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const err: typeof errors = {};
    if (name.trim().length < 2) err.name = 'Please enter your full name.';
    if (phone.trim() && !/^01[0-9]{9}$/.test(phone.trim())) err.phone = 'Use an 11-digit Bangladeshi mobile number (01XXXXXXXXX).';
    if (Object.keys(err).length) return setErrors(err);
    setBusy(true);
    const msg = await updateProfile(name, phone);
    setBusy(false);
    setErrors(msg ? { form: msg } : {});
    setSaved(!msg);
  }

  return (
    <form className="checkout-card" onSubmit={submit} noValidate>
      <h2><UserRound size={18} /> Personal details</h2>
      <div className="field-grid">
        <label>Full name<input value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} autoComplete="name" aria-invalid={!!errors.name} />{errors.name && <small className="err">{errors.name}</small>}</label>
        <label>Phone<input value={phone} onChange={(e) => { setPhone(e.target.value); setSaved(false); }} type="tel" placeholder="01XXXXXXXXX" autoComplete="tel" aria-invalid={!!errors.phone} />{errors.phone && <small className="err">{errors.phone}</small>}</label>
        <label className="full">Email<input value={user.email} readOnly disabled /><small style={{ fontWeight: 400, color: 'var(--muted)' }}>Your email is your sign-in and can’t be changed here.</small></label>
      </div>
      {errors.form && <small className="err" role="alert">{errors.form}</small>}
      <div className="profile-actions">
        {saved && <span className="saved-note"><Check size={15} /> Profile saved</span>}
        <button className="button button-orange" type="submit" disabled={!dirty || busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const { changePassword } = useAuth();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ cur?: string; next?: string; confirm?: string; form?: string }>({});
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const err: typeof errors = {};
    if (!cur) err.cur = 'Enter your current password.';
    if (next.length < 8) err.next = 'Password must be at least 8 characters.';
    else if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) err.next = 'Use both letters and numbers.';
    else if (next === cur) err.next = 'Choose a password different from the current one.';
    if (confirm !== next) err.confirm = 'Passwords do not match.';
    if (Object.keys(err).length) { setDone(false); return setErrors(err); }
    setBusy(true);
    const msg = await changePassword(cur, next);
    setBusy(false);
    if (msg) { setDone(false); return setErrors({ form: msg }); }
    setErrors({}); setDone(true); setCur(''); setNext(''); setConfirm('');
  }

  return (
    <form className="checkout-card" onSubmit={submit} noValidate>
      <h2><KeyRound size={18} /> Change password</h2>
      <PasswordField label="Current password" name="current" value={cur} onChange={setCur} autoComplete="current-password" error={errors.cur} />
      <div className="field-grid">
        <PasswordField label="New password" name="new" value={next} onChange={setNext} placeholder="8+ characters, letters + numbers" autoComplete="new-password" error={errors.next} />
        <PasswordField label="Confirm new password" name="confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" error={errors.confirm} />
      </div>
      {errors.form && <small className="err" role="alert">{errors.form}</small>}
      <div className="profile-actions">
        {done && <span className="saved-note"><Check size={15} /> Password updated</span>}
        <button className="button button-orange" type="submit" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
      </div>
    </form>
  );
}

export default function ProfilePage() {
  const { user, ready, logout } = useAuth();
  if (!ready) return <main className="inner-page" />;
  if (!user) {
    return (
      <main className="inner-page">
        <div className="cart-empty"><p>Please sign in to see your profile.</p><Link href="/login" className="button button-orange">Sign in</Link></div>
      </main>
    );
  }
  return (
    <main className="inner-page profile-page">
      <div className="page-intro">
        <span className="eyebrow">{user.isAdmin ? 'ADMIN ACCOUNT' : 'YOUR ACCOUNT'}</span>
        <h1>My <em>profile.</em></h1>
      </div>
      <section className="pf-hero">
        <div className="pf-cover" aria-hidden="true" />
        <div className="pf-hero-body">
          <div className="avatar big pf-avatar">{initials(user.name)}</div>
          <div className="profile-id">
            <b>{user.name}</b>
            <span className="profile-meta">
              <span className={`pill ${user.isAdmin ? 'low' : 'in'}`}>{user.isAdmin ? 'Administrator' : 'Customer'}</span>
            </span>
            <ul className="pf-facts">
              <li><Mail size={14} /> {user.email}</li>
              {user.phone && <li><Phone size={14} /> {user.phone}</li>}
              {user.createdAt && <li><CalendarDays size={14} /> Member since {formatDate(user.createdAt)}</li>}
            </ul>
          </div>
          <button className="button pf-signout" onClick={logout}><LogOut size={15} /> Sign out</button>
        </div>
      </section>
      {user.isAdmin ? <AdminSummary /> : <CustomerSummary />}
      <div className="profile-forms">
        <DetailsForm key={user.id + user.name + user.phone} />
        <PasswordForm />
      </div>
    </main>
  );
}
