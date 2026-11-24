'use client';
import { useState } from 'react';
import { CheckCheck, Trash2, Bell } from 'lucide-react';
import { KIND_LABEL, type NotifKind, useNotifications } from '@/lib/notifications';
import { NotificationItem, KIND_ICON } from '@/components/notification-item';

const TABS: (NotifKind | 'all')[] = ['all', 'order', 'stock', 'payment', 'customer'];
const EMPTY_TEXT: Record<NotifKind | 'all', string> = {
  all: 'No notifications yet.', order: 'No new orders to show.', stock: 'All products are well stocked.', payment: 'No payment updates.', customer: 'No customer activity.',
};

export default function NotificationCenter() {
  const [tab, setTab] = useState<NotifKind | 'all'>('all');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const { items, unread, loading, error, markRead, markAll, dismiss, clearRead } = useNotifications({ kind: tab, limit: 100 });
  const shown = onlyUnread ? items.filter((n) => !n.read) : items;

  return (
    <main className="inner-page admin-page">
      <div className="page-intro">
        <span className="eyebrow">NEXORA / NOTIFICATIONS</span>
        <h1>Notification <em>center.</em></h1>
        <p>New orders, low-stock alerts, payments and customer activity — in one place. Updates automatically every 30 seconds.</p>
      </div>

      <section className="nt-summary" aria-label="Unread summary">
        {(['order', 'stock', 'payment', 'customer'] as NotifKind[]).map((k) => {
          const Icon = KIND_ICON[k];
          return <button key={k} type="button" className={`nt-stat k-${k}${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}><span className="nt-icon"><Icon size={18} /></span><strong>{unread[k]}</strong><small>{KIND_LABEL[k]} unread</small></button>;
        })}
      </section>

      <div className="nt-panel">
        <div className="nt-toolbar">
          <div className="nt-tabs" role="tablist" aria-label="Notification type">
            {TABS.map((k) => (
              <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
                {KIND_LABEL[k]}{(k === 'all' ? unread.total : unread[k]) > 0 && <i>{k === 'all' ? unread.total : unread[k]}</i>}
              </button>
            ))}
          </div>
          <div className="nt-actions">
            <label className="nt-check"><input type="checkbox" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} /> Unread only</label>
            <button type="button" className="tm-ghost" disabled={!(tab === 'all' ? unread.total : unread[tab])} onClick={() => markAll(tab === 'all' ? undefined : tab)}><CheckCheck size={15} /> Mark {tab === 'all' ? 'all' : KIND_LABEL[tab].toLowerCase()} read</button>
            <button type="button" className="tm-ghost" onClick={() => clearRead()}><Trash2 size={15} /> Clear read</button>
          </div>
        </div>

        {error && <p className="nt-empty" role="alert">{error}</p>}
        {!error && loading && <p className="nt-empty">Loading…</p>}
        {!error && !loading && shown.length === 0 && <div className="nt-empty"><Bell size={26} /><p>{onlyUnread ? 'Nothing unread here.' : EMPTY_TEXT[tab]}</p></div>}
        {shown.length > 0 && (
          <ul className="nt-list">
            {shown.map((n) => <NotificationItem key={n.id} n={n} onOpen={(x) => { if (!x.read) markRead([x.id]); }} onDismiss={(x) => dismiss(x.id)} />)}
          </ul>
        )}
      </div>
    </main>
  );
}
