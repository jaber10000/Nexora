'use client';
import type { ReactNode } from 'react';

export const PALETTE = ['var(--chart-1)', 'var(--chart-ink)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--success-fill)', 'var(--error-fill)'];

export function Card({ title, sub, right, wide, children }: { title: string; sub?: ReactNode; right?: ReactNode; wide?: boolean; children: ReactNode }) {
  return (
    <section className={`dash-card${wide ? ' span-2' : ''}`}>
      <header>
        <div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
        {right}
      </header>
      {children}
    </section>
  );
}

export type Stat = { label: string; value: string; sub?: string; tone?: 'orange' | 'blue' | 'green' | 'violet' | 'amber' | 'red' };
export function MiniStats({ items }: { items: Stat[] }) {
  return (
    <div className="mini-stats">
      {items.map((s) => (
        <div className={`mini-stat tone-line-${s.tone ?? 'orange'}`} key={s.label}>
          <span>{s.label}</span><strong>{s.value}</strong>{s.sub && <small>{s.sub}</small>}
        </div>
      ))}
    </div>
  );
}

export const Section = ({ title, hint, children }: { title: string; hint: string; children: ReactNode }) => (
  <div className="analytics-section">
    <div className="section-title"><h2>{title}</h2><p>{hint}</p></div>
    {children}
  </div>
);

export function Progress({ pct, tone }: { pct: number; tone?: 'ok' | 'warn' | 'bad' }) {
  return <div className="progress"><i className={tone ?? 'ok'} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} /></div>;
}
