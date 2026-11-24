'use client';
import Link from 'next/link';
import { Search, ShoppingBag, Menu, X, User, Heart } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/components/store-provider';
import { useAuth } from '@/components/auth-provider';
import { StoreLogo } from '@/components/store-logo';
import { ThemeSwitcher } from '@/components/theme-switcher';

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { count, wishlist } = useStore();
  const { user } = useAuth();
  
  // Lock page scroll while the mobile drawer is open and close it with Escape.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open]);

  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const close = () => setOpen(false);

  return (
    <header className="site-header" ref={headerRef}>
      <div className="topline">Free delivery over ৳5,000 · Cash on delivery · 7-day easy returns</div>
      <div className="nav-wrap">
        <StoreLogo onClick={close} />

        {open && <button className="nav-scrim" aria-label="Close menu" onClick={close} />}
        <nav className={open ? 'nav-links show' : 'nav-links'} aria-label="Main navigation">
          <Link href="/" onClick={close}>Home</Link>
          <Link href="/products" onClick={close}>Shop</Link>
          <Link href="/#categories" onClick={close}>Categories</Link>
          <Link href="/#story" onClick={close}>About</Link>
          <Link href="/portfolio" onClick={close}>Portfolio</Link>
          {user && <Link href="/orders" onClick={close}>My orders</Link>}
        </nav>

        <div className="nav-actions">
          <ThemeSwitcher />
          <Link aria-label="Search products" href="/products"><Search size={20} /></Link>
          <Link aria-label="Wishlist" href="/wishlist" className="cart-link">
            <Heart size={20} />
            {wishlist.length > 0 && <span className="cart-badge">{wishlist.length}</span>}
          </Link>
          <Link aria-label={user ? 'My profile' : 'Sign in'} href={user ? '/profile' : '/login'}><User size={20} /></Link>
          <Link aria-label="Shopping bag" href="/cart" className="cart-link">
            <ShoppingBag size={20} />
            {count > 0 && <span className="cart-badge">{count > 99 ? '99+' : count}</span>}
          </Link>
          <button className="menu-toggle" onClick={() => setOpen(!open)} aria-label="Toggle menu" aria-expanded={open}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
    </header>
  );
}
