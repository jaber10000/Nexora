'use client';
// Bell with unread badge + quick dropdown for the admin sidebar / mobile top bar.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';
import { useNotifications } from '@/lib/notifications';
import { NotificationItem } from '@/components/notification-item';

export function NotificationBell() {
  const { items, unread, markRead, markAll, loading } = useNotifications({ limit: 8 });
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <div className="nt-bell" ref={box}>
      <button type="button" aria-label={`Notifications${unread.total ? `, ${unread.total} unread` : ''}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Bell size={19} />{unread.total > 0 && <span className="nt-badge">{unread.total > 99 ? '99+' : unread.total}</span>}
      </button>
      {open && (
        <div className="nt-pop" role="dialog" aria-label="Notifications">
          <header><h3>Notifications</h3><button type="button" disabled={!unread.total} onClick={() => markAll()}><CheckCheck size={15} /> Mark all read</button></header>
          {loading ? <p className="nt-empty">Loading…</p> : items.length === 0 ? <p className="nt-empty">You&apos;re all caught up.</p> : (
            <ul>{items.map((n) => <NotificationItem key={n.id} n={n} onOpen={(x) => { if (!x.read) markRead([x.id]); setOpen(false); }} />)}</ul>
          )}
          <footer><Link href="/admin/notifications" onClick={() => setOpen(false)}>Open Notification Center</Link></footer>
        </div>
      )}
    </div>
  );
}
