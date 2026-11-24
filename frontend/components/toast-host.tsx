'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

type Toast = { id: number; text: string; href?: string; cta?: string; tone?: 'success' | 'error' };

/** Notify from anywhere: window.dispatchEvent(new CustomEvent('nexora:toast', { detail: { text } })) */
export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const d = (e as CustomEvent<Omit<Toast, 'id'>>).detail;
      if (!d?.text) return;
      const id = Date.now() + Math.random();
      setToasts((t) => [...t.slice(-2), { ...d, id }]);
      window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
    };
    window.addEventListener('nexora:toast', onToast);
    return () => window.removeEventListener('nexora:toast', onToast);
  }, []);

  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone ?? ''}`}>
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>{t.text}</span>
          {t.href && <Link href={t.href}>{t.cta ?? 'View'}</Link>}
        </div>
      ))}
    </div>
  );
}
