'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, Minus, Plus, ShoppingBag, Check } from 'lucide-react';
import { useStore } from '@/components/store-provider';

export function ProductActions({ id, stock = 99 }: { id: number; stock?: number }) {
  const { addToCart, toggleWishlist, inWishlist } = useStore();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const liked = inWishlist(id);

  function add() {
    addToCart(id, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2200);
  }

  // Buy now: same cart logic as "Add to bag", then straight to checkout.
  function buyNow() {
    addToCart(id, qty);
    router.push('/checkout');
  }

  return (
    <div className="pd-actions">
      <div className="pd-row">
        <div className="qty-control" aria-label="Quantity">
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">
            <Minus size={15} />
          </button>
          <span>{qty}</span>
          <button onClick={() => setQty((q) => Math.min(stock, q + 1))} aria-label="Increase quantity">
            <Plus size={15} />
          </button>
        </div>
        <button className="button button-orange pd-add" onClick={add}>
          {added ? <Check size={17} /> : <ShoppingBag size={17} />}
          {added ? 'Added to bag' : 'Add to bag'}
        </button>
        <button
          className={liked ? 'pd-heart active' : 'pd-heart'}
          aria-label="Toggle wishlist"
          aria-pressed={liked}
          onClick={() => toggleWishlist(id)}
        >
          <Heart size={19} fill={liked ? 'currentColor' : 'none'} />
        </button>
      </div>
      <button className="button button-outline" onClick={buyNow}>Buy now</button>
      {added && (
        <Link href="/cart" className="text-link">
          View bag →
        </Link>
      )}
    </div>
  );
}
