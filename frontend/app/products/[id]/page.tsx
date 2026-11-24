
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { ArrowLeft, Check, Truck, ShieldCheck } from 'lucide-react';

import { ProductActions } from '@/components/product-actions';
import { ProductCard } from '@/components/product-card';
import { Rating } from '@/components/rating';

import { formatBDT, galleryOf } from '@/lib/products';
import { ProductGallery } from '@/components/product-gallery';
import { useCatalog } from '@/lib/catalog';
import { ProductReviews } from '@/components/product-reviews';
import { trackProductView } from '@/lib/engagement';
import { api, errMsg } from '@/lib/api';
import type { Product } from '@/lib/products';

export default function ProductDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { items: products, ready, getProduct } = useCatalog();

  const cachedProduct = getProduct(Number(id));
  const [remoteProduct, setRemoteProduct] = useState<Product | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const product = cachedProduct ?? remoteProduct;

  // If the product isn't in the shared list cache (deep link, refresh, cache/API race),
  // fetch it directly instead of incorrectly showing the 404 page.
  useEffect(() => {
    if (!ready || cachedProduct || !Number.isFinite(Number(id))) return;
    setDetailLoading(true);
    api<Product>(`/api/products/${Number(id)}`)
      .then((row) => { setRemoteProduct(row); setDetailError(null); })
      .catch((error) => setDetailError(errMsg(error)))
      .finally(() => setDetailLoading(false));
  }, [ready, cachedProduct, id]);

  // Recently Viewed tracking
  useEffect(() => {
    if (!ready || !product?.id) return;

    trackProductView(product.id).catch((error) => {
      console.error('Recently viewed tracking failed:', error);
    });
  }, [ready, product?.id]);

  if (!ready) {
    return <main className="inner-page" />;
  }

  if (!product) {
    if (detailLoading) return <main className="inner-page"><p className="empty-state">Loading product…</p></main>;
    if (detailError) return <main className="inner-page"><Link href="/products" className="text-link pd-back"><ArrowLeft size={16}/> Back to shop</Link><section className="empty-state"><h2>Unable to load this product</h2><p>{detailError}</p><p>Check that the backend is running and the product still exists.</p><button className="btn" onClick={()=>{setDetailError(null);setDetailLoading(true);api<Product>(`/api/products/${Number(id)}`).then(setRemoteProduct).catch(e=>setDetailError(errMsg(e))).finally(()=>setDetailLoading(false));}}>Try again</button></section></main>;
    notFound();
  }

  const related = products.filter(
    (p) => p.id !== product.id && p.category === product.category
  );

  const more =
    related.length >= 2
      ? related
      : products.filter((p) => p.id !== product.id).slice(0, 3);

  const inStock = (product.stock ?? 1) > 0;
  const saving = product.oldPrice
    ? product.oldPrice - product.price
    : 0;

  return (
    <main className="inner-page">
      <Link href="/products" className="text-link pd-back">
        <ArrowLeft size={16} /> Back to shop
      </Link>

      <section className="pd-layout">
        <ProductGallery images={galleryOf(product)} name={product.name} tag={product.tag} />

        <div className="pd-info">
          <span className="eyebrow">{product.category}</span>

          <h1>{product.name}</h1>

          {product.ratingAvg != null && product.ratingAvg > 0 && (
            <Rating
              value={product.ratingAvg}
              count={product.reviewCount ?? 0}
            />
          )}

          <div className="pd-price">
            {formatBDT(product.price)}

            {product.oldPrice && (
              <del>{formatBDT(product.oldPrice)}</del>
            )}

            {saving > 0 && (
              <span className="pd-save">
                Save {formatBDT(saving)}
              </span>
            )}
          </div>

          {product.description && (
            <p className="pd-desc">{product.description}</p>
          )}

          {product.features && (
            <ul className="pd-features">
              {product.features.map((feature) => (
                <li key={feature}>
                  <Check size={16} /> {feature}
                </li>
              ))}
            </ul>
          )}

          <p className={inStock ? 'pd-stock in' : 'pd-stock out'}>
            {inStock
              ? (product.stock ?? 99) <= 8
                ? `Only ${product.stock} left — order soon`
                : 'In stock · ready to ship'
              : 'Out of stock'}
          </p>

          {inStock && (
            <ProductActions
              id={product.id}
              stock={product.stock}
            />
          )}

          <div className="pd-assurance">
            <span>
              <Truck size={17} /> Delivery in 3–5 days, free over ৳5,000
            </span>
            <span>
              <ShieldCheck size={17} /> Secure payment &amp; cash on delivery
            </span>
            <span>
              <Check size={17} /> 7-day easy returns
            </span>
          </div>
        </div>
      </section>

      <ProductReviews productId={product.id} />

      <section className="pd-related">
        <span className="eyebrow">YOU MAY ALSO LIKE</span>

        <div className="product-grid">
          {more.slice(0, 4).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </main>
  );
}
