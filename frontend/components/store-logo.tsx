'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';
import { useSettings } from '@/lib/admin-data';

// One place that decides which brand image to show: the store logo uploaded in
// Admin → Settings, or the NEXORA monogram when none is set. The customer's own
// profile picture is never used here; it stays on the profile page only.
export function StoreLogo({ light = false, size = 32, height = 34, href = '/', onClick, className = '' }: {
  light?: boolean; size?: number; height?: number; href?: string | null; onClick?: () => void; className?: string;
}) {
  const [settings] = useSettings();
  if (!settings.logo) return <BrandLogo name={settings.storeName} light={light} size={size} href={href} onClick={onClick} className={className} />;
  const img = <img src={settings.logo} alt={settings.storeName} style={{ height, width: 'auto', maxWidth: 180, objectFit: 'contain' }} />;
  return href === null
    ? <span className={`brand ${className}`.trim()}>{img}</span>
    : <Link href={href} className={`brand ${className}`.trim()} onClick={onClick} aria-label={`${settings.storeName} home`}>{img}</Link>;
}

// Browser-tab icon: store logo from Settings, otherwise the NEXORA favicon.
export function DynamicFavicon() {
  const [settings] = useSettings();
  useEffect(() => {
    const href = settings.logo || '/favicon.svg';
    document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]').forEach((l) => l.remove());
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = href;
    if (href.startsWith('data:image/')) link.type = href.slice(5, href.indexOf(';'));
    document.head.appendChild(link);
    return () => { link.remove(); };
  }, [settings.logo]);
  return null;
}
