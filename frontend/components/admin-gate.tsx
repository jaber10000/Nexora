'use client';
// Admin protection: signs in against the backend and requires an account with is_admin = true.
// The API enforces the same rule on every admin endpoint, so this gate is only for the UI.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Boxes, PackagePlus, Tags, ClipboardList, Users, BarChart3, Ticket, Settings, LogOut, ShieldCheck, UserCircle, MessageSquare, Menu, X, Palette, Bell } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { StoreLogo } from '@/components/store-logo';
import { NotificationBell } from '@/components/notification-bell';
import { useNotifications } from '@/lib/notifications';

export function AdminGate({ children }: { children: React.ReactNode }) {
  const { user, ready, login, logout } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const path = usePathname();

  // Mobile drawer: lock page scroll while open, close on Escape or navigation.
  useEffect(() => {
    document.body.style.overflow = menu ? 'hidden' : '';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [menu]);
  useEffect(() => { setMenu(false); }, [path]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const msg = await login(String(f.get('email') || ''), String(f.get('password') || ''));
    setBusy(false);
    setError(msg ?? '');
  }

  if (!ready) return <main className="auth-page" />;

  if (!user || !user.isAdmin) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <span className="eyebrow"><ShieldCheck size={13} style={{ verticalAlign: '-2px' }} /> ADMIN ONLY</span>
          <h1>Secure <em>admin panel.</em></h1>
          <p>Sign in with your administrator account to manage NEXORA.</p>
          {user && !user.isAdmin && <small role="alert" style={{ color: 'var(--error)' }}>{user.email} is not an administrator account.</small>}
          <form onSubmit={onSubmit}>
            <label>Admin email
              <input name="email" type="email" autoComplete="username" required />
            </label>
            <label>Password
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            {error && <small role="alert" style={{ color: 'var(--error)' }}>{error}</small>}
            <button className="button button-orange" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Enter admin panel'}</button>
          </form>
        </div>
      </main>
    );
  }

  const tabs = [
    { href: '/admin', label: 'Overview', icon: LayoutDashboard },
    { href: '/admin/notifications', label: 'Notifications', icon: Bell },
    { href: '/admin/products', label: 'Products', icon: PackagePlus },
    { href: '/admin/categories', label: 'Categories', icon: Tags },
    { href: '/admin/inventory', label: 'Inventory', icon: Boxes },
    { href: '/admin/orders', label: 'Orders', icon: ClipboardList },
    { href: '/admin/customers', label: 'Customers', icon: Users },
    { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/admin/reviews', label: 'Reviews', icon: MessageSquare },
    { href: '/admin/coupons', label: 'Coupons', icon: Ticket },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
    { href: '/admin/appearance', label: 'Appearance', icon: Palette },
  ];
  const isActive = (href: string) => (href === '/admin' ? path === href : path === href || path.startsWith(href + '/'));
  return (
    <div className="admin-shell">
      <div className="admin-topbar">
        <button onClick={() => setMenu(true)} aria-label="Open admin menu"><Menu size={20} /></button>
        <span><StoreLogo light size={24} height={26} href={null} /></span>
        <NotificationBell />
      </div>
      {menu && <button className="admin-scrim open" aria-label="Close admin menu" onClick={() => setMenu(false)} />}
      <aside className={menu ? 'admin-sidebar open' : 'admin-sidebar'} aria-label="Admin navigation">
        <div className="side-brand"><StoreLogo light size={28} height={30} href="/" /><NotificationBell /></div>
        <span className="side-title">Manage store</span>
        {tabs.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={isActive(href) ? 'active' : ''} onClick={() => setMenu(false)}><Icon size={18} /> {label}{href === '/admin/notifications' && <SideBadge />}</Link>
        ))}
        <span className="side-spacer" />
        <Link href="/profile" className={path === '/profile' ? 'active' : ''} onClick={() => setMenu(false)}><UserCircle size={18} /> Profile</Link>
        <button onClick={logout}><LogOut size={18} /> Sign out</button>
        {menu && <button className="admin-close" onClick={() => setMenu(false)} aria-label="Close menu" style={{ position: 'absolute', top: 12, right: 12, width: 38 }}><X size={18} /></button>}
      </aside>
      <div className="admin-content">{children}</div>
    </div>
  );
}


function SideBadge() {
  const { unread } = useNotifications({ limit: 1, poll: 30000 });
  return unread.total > 0 ? <span className="side-badge">{unread.total > 99 ? '99+' : unread.total}</span> : null;
}
