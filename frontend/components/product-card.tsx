'use client';
import Link from 'next/link';
import { Heart, ShoppingBag } from 'lucide-react';
import { useStore } from '@/components/store-provider';
import { Rating } from '@/components/rating';
import { formatBDT, type Product } from '@/lib/products';

export type { Product };

export function ProductCard({ product }: { product: Product }) {
  const { addToCart, toggleWishlist, inWishlist } = useStore();
  const liked = inWishlist(product.id);
  const href = `/products/${product.id}`;
  const left = product.stock ?? 99;
  const out = left <= 0;
  const off = product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;

  return (
    <article className="product-card">
      <div className="product-image" style={{ backgroundImage: `url('${product.image}')` }}>
        <Link href={href} className="card-link" aria-label={`View ${product.name}`} />
        {product.tag && <span className="product-tag">{product.tag}</span>}
        {off > 0 && <span className="off-chip">-{off}%</span>}
        <button className={liked ? 'heart-btn active' : 'heart-btn'} aria-label={liked ? `Remove ${product.name} from wishlist` : `Save ${product.name}`} aria-pressed={liked} onClick={() => toggleWishlist(product.id)}>
          <Heart size={17} fill={liked ? 'currentColor' : 'none'} />
        </button>
        <button className="quick-add" aria-label={`Add ${product.name} to bag`} disabled={out} onClick={() => addToCart(product.id)}>
          <ShoppingBag size={16} /> {out ? 'Out of stock' : 'Quick add'}
        </button>
      </div>
      <div className="product-meta">
        <div>
          <span className="eyebrow">{product.category}</span>
          <h3><Link href={href}>{product.name}</Link></h3>
          {product.ratingAvg != null && product.ratingAvg > 0 && <Rating value={product.ratingAvg} count={product.reviewCount ?? 0} />}
          {out ? <small className="stock-chip">Out of stock</small> : left <= 8 && <small className="stock-chip">Only {left} left</small>}
        </div>
        <div className="price">{formatBDT(product.price)}{product.oldPrice && <del>{formatBDT(product.oldPrice)}</del>}</div>
      </div>
    </article>
  );
}
