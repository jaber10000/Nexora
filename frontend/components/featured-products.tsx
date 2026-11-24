'use client';
import { useMemo, useState } from 'react';
import { ProductCard } from '@/components/product-card';
import { useCatalog } from '@/lib/catalog';

type Mode = 'trending' | 'new' | 'best';
const TABS: { key: Mode; label: string }[] = [
  { key: 'trending', label: 'Trending' },
  { key: 'new', label: 'New arrivals' },
  { key: 'best', label: 'Best sellers' },
];

// Home page product shelf — reads the live catalog managed in the admin panel
// and re-orders it per tab (views / newest / units sold). No data is invented.
export function FeaturedProducts({ mode: fixed, limit = 4 }: { mode?: Mode; limit?: number } = {}) {
  const { items, ready } = useCatalog();
  const [picked, setMode] = useState<Mode>('trending');
  const mode = fixed ?? picked;

  const shown = useMemo(() => {
    const list = [...items];
    if (mode === 'trending') list.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    if (mode === 'new') list.sort((a, b) => b.id - a.id);
    if (mode === 'best') list.sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0));
    return list.slice(0, limit);
  }, [items, mode, limit]);

  return (
    <>
      {!fixed && <div className="home-tabs" role="tablist" aria-label="Product collections">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={mode === t.key} className={mode === t.key ? 'active' : ''} onClick={() => setMode(t.key)}>
            {t.label}
          </button>
        ))}
      </div>}

      <div className="product-grid">
        {!ready && items.length === 0
          ? [0, 1, 2, 3].map((i) => (
              <div key={i} aria-hidden="true">
                <span className="skeleton" style={{ aspectRatio: '4 / 5' }} />
                <span className="skeleton" style={{ height: 14, width: '70%', marginTop: 14 }} />
                <span className="skeleton" style={{ height: 14, width: '40%', marginTop: 8 }} />
              </div>
            ))
          : shown.map((product) => <ProductCard key={product.id} product={product} />)}
      </div>
    </>
  );
}
