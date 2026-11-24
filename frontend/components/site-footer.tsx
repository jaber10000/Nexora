'use client';
import Link from 'next/link';
import { useSettings } from '@/lib/admin-data';
import { StoreLogo } from '@/components/store-logo';

// Footer text and contact details come from Admin → Settings.
const href = (u: string) => (/^https?:\/\//.test(u) ? u : `https://${u}`);

export function SiteFooter() {
  const [s] = useSettings();
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-about">
          <StoreLogo light size={34} className="footer-brand" />
          <p>{s.tagline}<br />{s.address}</p>
        </div>

        <div className="footer-col">
          <h4>Shop</h4>
          <div className="footer-links">
            <Link href="/products">All products</Link>
            <Link href="/wishlist">Wishlist</Link>
            <Link href="/cart">Shopping bag</Link>
          </div>
        </div>

        <div className="footer-col">
          <h4>Account</h4>
          <div className="footer-links">
            <Link href="/login">My account</Link>
            <Link href="/orders">Track my order</Link>
            <Link href="/admin">Admin</Link>
          </div>
        </div>

        <div className="footer-col">
          <h4>Contact</h4>
          <div className="footer-links">
            <a href={`mailto:${s.email}`}>Help &amp; support</a>
            {s.phone && <a href={`tel:${s.phone.replace(/\s/g, '')}`}>{s.phone}</a>}
            {s.facebook && <a href={href(s.facebook)} target="_blank" rel="noreferrer">Facebook</a>}
            {s.instagram && <a href={href(s.instagram)} target="_blank" rel="noreferrer">Instagram</a>}
            <Link href="/portfolio">Developer portfolio</Link>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2026 {s.storeName}. All rights reserved.</span>
          <span>{s.hours} · Prices in BDT</span>
        </div>
      </div>
    </footer>
  );
}
