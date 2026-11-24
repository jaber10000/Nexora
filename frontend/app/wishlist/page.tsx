'use client';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { useStore } from '@/components/store-provider';
import { ProductCard } from '@/components/product-card';
import { useCatalog } from '@/lib/catalog';

export default function WishlistPage() {
  const { wishlist, ready } = useStore();
  const { items } = useCatalog();
  // keep the saved order, skip products the admin has since deleted
  const saved = wishlist.map((id) => items.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);

  return (
    <main className="inner-page">
      <div className="page-intro">
        <span className="eyebrow">SAVED FOR LATER</span>
        <h1>My <em>wishlist.</em></h1>
        <p>Tap the heart on any product to save it here.</p>
      </div>
      {!ready ? null : saved.length === 0 ? (
        <div className="cart-empty">
          <Heart size={38} />
          <p>Your wishlist is empty.</p>
          <Link href="/products" className="button button-orange">Browse products</Link>
        </div>
      ) : (
        <>
          <p className="result-count">{saved.length} SAVED</p>
          <div className="product-grid">{saved.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        </>
      )}
    </main>
  );
}
