
'use client';

import Link from 'next/link';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { useStore } from '@/components/store-provider';
import { formatBDT } from '@/lib/products';
import { useCatalog } from '@/lib/catalog';
import { useEffect, useState } from 'react';
import { checkCouponApi } from '@/lib/orders';
import { errMsg } from '@/lib/api';
import {
  saveCartCoupon,
  getCartCoupon,
  clearCartCoupon,
} from '@/lib/cart-coupon';

const FREE_DELIVERY_OVER = 5000;
const DELIVERY_FEE = 120;

export default function CartPage() {
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount: number;
  } | null>(null);
  const [couponMessage, setCouponMessage] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);

  const { items, ready, setQuantity, removeFromCart, clearCart } = useStore();
  const { getProduct, ready: catalogReady } = useCatalog();

  useEffect(() => {
    const savedCoupon = getCartCoupon();
    if (savedCoupon) {
      setCouponCode(savedCoupon);
    }
  }, []);

  const lines = items
    .map((i) => ({
      ...i,
      product: getProduct(i.id),
    }))
    .filter(
      (l): l is typeof l & {
        product: NonNullable<typeof l.product>;
      } => !!l.product
    );

  const subtotal = lines.reduce(
    (s, l) => s + l.product.price * l.quantity,
    0
  );

  const delivery =
    lines.length === 0 || subtotal >= FREE_DELIVERY_OVER
      ? 0
      : DELIVERY_FEE;

  const discount = appliedCoupon?.discount ?? 0;
  const total = Math.max(0, subtotal - discount + delivery);

  async function applyCoupon() {
    if (!couponCode.trim()) return;

    setCouponBusy(true);
    setCouponMessage('');

    try {
      const result = await checkCouponApi(
        couponCode.trim(),
        subtotal
      );

      if (result.ok) {
        setAppliedCoupon({
          code: result.code,
          discount: result.discount,
        });

        setCouponCode(result.code);
        saveCartCoupon(result.code);
        setCouponMessage('Coupon successfully applied!');
      } else {
        setAppliedCoupon(null);
        clearCartCoupon();
        setCouponMessage(result.error);
      }
    } catch (error) {
      setAppliedCoupon(null);
      clearCartCoupon();
      setCouponMessage(errMsg(error));
    } finally {
      setCouponBusy(false);
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponMessage('Coupon removed.');
    clearCartCoupon();
  }

  return (
    <main className="inner-page">
      <div className="page-intro">
        <span className="eyebrow">YOUR BAG</span>
        <h1>
          Shopping <em>bag.</em>
        </h1>
      </div>

      {!ready || !catalogReady ? null : lines.length === 0 ? (
        <div className="cart-empty">
          <ShoppingBag size={38} />
          <p>Your bag is empty.</p>
          <Link href="/products" className="button button-orange">
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="cart-layout">
          <div className="cart-list">
            {lines.map(({ product, quantity }) => (
              <div className="cart-item" key={product.id}>
                <Link
                  href={`/products/${product.id}`}
                  className="cart-thumb"
                  style={{
                    backgroundImage: `url('${product.image}')`,
                  }}
                  aria-label={product.name}
                />

                <div className="cart-detail">
                  <span className="eyebrow">
                    {product.category}
                  </span>

                  <Link
                    href={`/products/${product.id}`}
                    className="cart-name"
                  >
                    {product.name}
                  </Link>

                  <span className="cart-unit">
                    {formatBDT(product.price)} each
                  </span>

                  {(product.stock ?? 99) <= 0 && (
                    <small className="err">
                      Out of stock — remove to checkout
                    </small>
                  )}

                  {(product.stock ?? 99) > 0 &&
                    quantity > (product.stock ?? 99) && (
                      <small className="err">
                        Only {product.stock} available
                      </small>
                    )}

                  <div className="qty-control small">
                    <button
                      onClick={() =>
                        setQuantity(product.id, quantity - 1)
                      }
                      aria-label="Decrease quantity"
                    >
                      <Minus size={14} />
                    </button>

                    <span>{quantity}</span>

                    <button
                      onClick={() =>
                        setQuantity(
                          product.id,
                          Math.min(
                            product.stock ?? 99,
                            quantity + 1
                          )
                        )
                      }
                      aria-label="Increase quantity"
                      disabled={quantity >= (product.stock ?? 99)}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                <div className="cart-side">
                  <strong>
                    {formatBDT(product.price * quantity)}
                  </strong>

                  <button
                    className="cart-remove"
                    onClick={() => removeFromCart(product.id)}
                  >
                    <Trash2 size={15} /> Remove
                  </button>
                </div>
              </div>
            ))}

            <button className="cart-clear" onClick={clearCart}>
              Clear bag
            </button>
          </div>

          <aside className="cart-summary">
            <h2>Order summary</h2>

            <div>
              <span>Subtotal</span>
              <span>{formatBDT(subtotal)}</span>
            </div>

            {/* Coupon Section */}
            <div className="cart-coupon">
              <h3>Have a coupon?</h3>

              <div className="cart-coupon-input">
                <input
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value.toUpperCase());
                    setAppliedCoupon(null);
                    setCouponMessage('');
                    clearCartCoupon();
                  }}
                  placeholder="Enter coupon code"
                  aria-label="Coupon code"
                />

                <button
                  type="button"
                  className="button"
                  onClick={applyCoupon}
                  disabled={couponBusy || !couponCode.trim()}
                >
                  {couponBusy ? 'Checking…' : 'Apply'}
                </button>
              </div>

              {couponMessage && (
                <small
                  className={appliedCoupon ? 'success-note' : 'err'}
                >
                  {couponMessage}
                </small>
              )}

              {appliedCoupon && (
                <button
                  type="button"
                  className="text-link"
                  onClick={removeCoupon}
                >
                  Remove coupon
                </button>
              )}
            </div>

            {discount > 0 && (
              <div>
                <span>Discount ({appliedCoupon?.code})</span>
                <span>−{formatBDT(discount)}</span>
              </div>
            )}

            <div>
              <span>Delivery</span>
              <span>
                {delivery === 0 ? 'Free' : formatBDT(delivery)}
              </span>
            </div>

            {delivery > 0 && (
              <small>
                Add{' '}
                {formatBDT(FREE_DELIVERY_OVER - subtotal)} more
                for free delivery.
              </small>
            )}

            <div className="cart-total">
              <span>Total</span>
              <span>{formatBDT(total)}</span>
            </div>

            <Link
              href="/checkout"
              className="button button-orange"
            >
              Proceed to checkout
            </Link>

            <Link href="/products" className="text-link">
              Continue shopping
            </Link>
          </aside>
        </div>
      )}
    </main>
  );
}
