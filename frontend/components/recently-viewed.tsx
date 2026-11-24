
'use client';

import { useEffect, useState } from 'react';
import { ProductCard } from '@/components/product-card';
import { fetchRecentlyViewed } from '@/lib/engagement';
import type { Product } from '@/lib/products';

export function RecentlyViewed() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentlyViewed()
      .then((data) => setProducts(Array.isArray(data) ? data.slice(0, 5) : []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading || products.length === 0) return null;

  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">YOUR BROWSING HISTORY</span>
          <h2>Recently <em>viewed.</em></h2>
          <p className="muted">Products you explored recently.</p>
        </div>
      </div>

      <div className="product-grid">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
