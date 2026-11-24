'use client';
import Link from 'next/link';
import { ShoppingBag, PackageX, CreditCard, UserPlus, X } from 'lucide-react';
import { type Notif, type NotifKind, timeAgo } from '@/lib/notifications';

export const KIND_ICON: Record<NotifKind, React.ComponentType<{ size?: number }>> = { order: ShoppingBag, stock: PackageX, payment: CreditCard, customer: UserPlus };

export function NotificationItem({ n, onOpen, onDismiss }: { n: Notif; onOpen: (n: Notif) => void; onDismiss?: (n: Notif) => void }) {
  const Icon = KIND_ICON[n.kind];
  return (
    <li className={`nt-item ${n.read ? '' : 'unread'} sev-${n.severity}`}>
      <Link href={n.link || '/admin'} className="nt-link" onClick={() => onOpen(n)}>
        <span className="nt-icon"><Icon size={17} /></span>
        <span className="nt-text"><b>{n.title}</b><small>{n.body}</small></span>
        <time className="nt-time">{timeAgo(n.createdAt)}</time>
      </Link>
      {onDismiss && <button type="button" className="nt-x" aria-label={`Dismiss ${n.title}`} onClick={() => onDismiss(n)}><X size={14} /></button>}
    </li>
  );
}
