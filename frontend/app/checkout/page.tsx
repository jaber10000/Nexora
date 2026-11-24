
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/components/store-provider';
import { useAuth } from '@/components/auth-provider';
import { formatBDT } from '@/lib/products';
import { useCatalog } from '@/lib/catalog';
import { errMsg } from '@/lib/api';
import {
  FREE_DELIVERY_OVER,
  paymentMethods,
  shippingOptions,
  placeOrder,
  checkCouponApi,
  type PaymentId,
  type ShippingId,
} from '@/lib/orders';

import {
  getCartCoupon,
  saveCartCoupon,
  clearCartCoupon,
} from '@/lib/cart-coupon';

const districts = [
  'Dhaka',
  'Chattogram',
  'Sylhet',
  'Rajshahi',
  'Khulna',
  'Barishal',
  'Rangpur',
  'Mymensingh',
  'Cumilla',
  'Gazipur',
  'Narayanganj',
  'Other',
];

export default function CheckoutPage() {
  const { items, ready, clearCart } = useStore();
  const { user } = useAuth();
  const router = useRouter();

  const [shipping, setShipping] = useState<ShippingId>('standard');
  const [payment, setPayment] = useState<PaymentId>('cod');

  const { getProduct, ready: catalogReady, refresh } = useCatalog();

  const [code, setCode] = useState('');
  const [applied, setApplied] = useState<{
    code: string;
    discount: number;
  } | null>(null);

  const [couponMsg, setCouponMsg] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const [stockError, setStockError] = useState('');
  const [placing, setPlacing] = useState(false);

  // Prevent loading the saved coupon more than once.
  const couponInitialized = useRef(false);

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

  const ship = shippingOptions.find((s) => s.id === shipping)!;

  const delivery =
    lines.length === 0 ||
    (ship.freeOver && subtotal >= FREE_DELIVERY_OVER)
      ? 0
      : ship.fee;

  const discount = applied?.discount ?? 0;
  const total = subtotal - discount + delivery;

  // Load saved coupon when cart and catalog are ready.
  useEffect(() => {
    if (!ready || !catalogReady || couponInitialized.current) {
      return;
    }

    couponInitialized.current = true;

    const savedCode = getCartCoupon();

    if (!savedCode || subtotal <= 0) return;

    setCode(savedCode);

    checkCouponApi(savedCode, subtotal)
      .then((result) => {
        if (result.ok) {
          setApplied({
            code: result.code,
            discount: result.discount,
          });

          setCode(result.code);
          setCouponMsg(`Coupon ${result.code} applied.`);
          saveCartCoupon(result.code);
        } else {
          setApplied(null);
          clearCartCoupon();
          setCouponMsg(result.error);
        }
      })
      .catch((error) => {
        clearCartCoupon();
        setApplied(null);
        setCouponMsg(errMsg(error));
      });

    // Load saved coupon once when checkout opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, catalogReady]);

  // Revalidate coupon when cart subtotal changes.
  useEffect(() => {
    if (!couponInitialized.current || !applied) return;

    let cancelled = false;

    checkCouponApi(applied.code, subtotal)
      .then((result) => {
        if (cancelled) return;

        if (result.ok) {
          setApplied({
            code: result.code,
            discount: result.discount,
          });
          saveCartCoupon(result.code);
        } else {
          setApplied(null);
          clearCartCoupon();
          setCouponMsg(result.error);
        }
      })
      .catch(() => {
        // Keep the current coupon state.
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  // Apply coupon manually.
  async function applyCoupon() {
    if (!code.trim() || couponBusy) return;

    setCouponBusy(true);
    setCouponMsg('');

    try {
      const r = await checkCouponApi(code.trim(), subtotal);

      if (r.ok) {
        setApplied({
          code: r.code,
          discount: r.discount,
        });

        setCode(r.code);
        saveCartCoupon(r.code);

        setCouponMsg(`Coupon ${r.code} applied.`);
      } else {
        setApplied(null);
        clearCartCoupon();
        setCouponMsg(r.error);
      }
    } catch (e) {
      setApplied(null);
      clearCartCoupon();
      setCouponMsg(errMsg(e));
    } finally {
      setCouponBusy(false);
    }
  }

  // Remove coupon.
  function removeCoupon() {
    setApplied(null);
    setCode('');
    setCouponMsg('Coupon removed.');
    clearCartCoupon();
  }

  if (!ready || !catalogReady) return null;

  if (!user) {
    return (
      <main className="inner-page">
        <div className="cart-empty">
          <p>Please sign in to continue to checkout.</p>
          <Link href="/login" className="button button-orange">
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  if (lines.length === 0) {
    return (
      <main className="inner-page">
        <div className="cart-empty">
          <p>Your bag is empty.</p>
          <Link href="/products" className="button button-orange">
            Start shopping
          </Link>
        </div>
      </main>
    );
  }

  // Place order.
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const f = new FormData(e.currentTarget);

    setStockError('');
    setPlacing(true);

    try {
      const order = await placeOrder({
        lines: lines.map((l) => ({
          id: l.id,
          quantity: l.quantity,
        })),

        shipping,
        payment,

        coupon: applied?.code,

        address: {
          name: String(f.get('name')),
          phone: String(f.get('phone')),
          address: String(f.get('address')),
          area: String(f.get('area')),
          district: String(f.get('district')),
        },

        ...(payment === 'bkash_p2p' || payment === 'nagad_p2p'
          ? { payment_info: { sender_number: String(f.get('pay_number') || ''), trx_id: String(f.get('pay_txn') || ''), payment_method: payment, payment_status: 'pending_verification', demo: true } }
          : payment === 'sslcommerz_demo'
            ? { payment_info: { payment_method: payment, trx_id: `DEMO-SSL-${Date.now().toString(36).toUpperCase()}`, payment_status: 'pending_verification', demo: true } }
            : {}),
      });

      // Clear cart and saved coupon after successful order.
      clearCart();
      clearCartCoupon();

      refresh();

      router.push(`/orders?placed=${order.id}`);
    } catch (err) {
      setStockError(errMsg(err));
      refresh();
      setPlacing(false);
    }
  }

  return (
    <main className="inner-page">
      <div className="page-intro">
        <span className="eyebrow">ALMOST THERE</span>
        <h1>
          <em>Checkout.</em>
        </h1>
      </div>

      {/* Progress indicator — presentational; all three sections stay on one page */}
      <ol className="checkout-steps" aria-label="Checkout progress">
        <li className="done"><span>Bag</span></li>
        <li className="active"><span>Details &amp; shipping</span></li>
        <li><span>Payment</span></li>
        <li><span>Confirmation</span></li>
      </ol>

      <form
        className="cart-layout checkout-form"
        onSubmit={onSubmit}
      >
        <div className="checkout-main">

          {/* 1. Delivery Address */}
          <section className="checkout-card">
            <h2>1. Delivery address</h2>

            <div className="field-grid">
              <label>
                Full name
                <input
                  name="name"
                  placeholder="Your full name"
                  required
                />
              </label>

              <label>
                Phone
                <input
                  name="phone"
                  type="tel"
                  placeholder="01XXXXXXXXX"
                  pattern="01[0-9]{9}"
                  title="11-digit Bangladeshi mobile number"
                  required
                />
              </label>

              <label className="full">
                Address
                <input
                  name="address"
                  placeholder="House, road, village / apartment"
                  required
                />
              </label>

              <label>
                Area / Thana
                <input
                  name="area"
                  placeholder="e.g. Mirpur"
                  required
                />
              </label>

              <label>
                District
                <select name="district" defaultValue="Dhaka">
                  {districts.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          {/* 2. Shipping Method */}
          <section className="checkout-card">
            <h2>2. Shipping method</h2>

            <div className="option-list">
              {shippingOptions.map((o) => (
                <label
                  key={o.id}
                  className={
                    'option' + (shipping === o.id ? ' active' : '')
                  }
                >
                  <input
                    type="radio"
                    name="shipping"
                    checked={shipping === o.id}
                    onChange={() => setShipping(o.id)}
                  />

                  <span>
                    <strong>{o.label}</strong>
                    <small>{o.note}</small>
                  </span>

                  <b>
                    {o.freeOver && subtotal >= FREE_DELIVERY_OVER
                      ? 'Free'
                      : formatBDT(o.fee)}
                  </b>
                </label>
              ))}
            </div>
          </section>

          {/* 3. Payment */}
          <section className="checkout-card">
            <h2>3. Payment</h2>

            <div className="option-list">
              {paymentMethods.map((m) => (
                <label
                  key={m.id}
                  className={
                    'option' + (payment === m.id ? ' active' : '')
                  }
                >
                  <input
                    type="radio"
                    name="payment"
                    checked={payment === m.id}
                    onChange={() => setPayment(m.id)}
                  />

                  <span>
                    <strong>{m.label}</strong>
                    <small>{m.note}</small>
                  </span>
                </label>
              ))}
            </div>

            {(payment === 'bkash_p2p' || payment === 'nagad_p2p') && (
              <div className="pay-detail">
                <p>
                  Send <b>{formatBDT(total)}</b> to merchant number{' '}
                  <b>01XXXXXXXXX</b> via{' '}
                  {payment === 'bkash_p2p' ? 'bKash' : 'Nagad'}, then enter
                  the details below.
                </p>

                <div className="field-grid">
                  <label>
                    Your {payment === 'bkash_p2p' ? 'bKash' : 'Nagad'} number
                    <input
                      name="pay_number"
                      placeholder="01XXXXXXXXX"
                      required
                    />
                  </label>

                  <label>
                    Transaction ID
                    <input
                      name="pay_txn"
                      placeholder="Dummy transaction ID (e.g. ABC123XYZ)"
                      required
                    />
                  </label>
                </div>
              </div>
            )}

            {payment === 'sslcommerz_demo' && (
              <div className="pay-detail">
                <p>
                  Demo only: this simulates a gateway checkout and does not charge money. A demo reference will be attached to the order and its payment remains pending verification.
                </p>
              </div>
            )}

            {payment === 'cod' && (
              <div className="pay-detail">
                <p>
                  Please keep <b>{formatBDT(total)}</b> ready in cash
                  for the delivery person.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Order Summary */}
        <aside className="cart-summary">
          <h2>Order summary</h2>

          {lines.map((l) => (
            <div key={l.id}>
              <span>
                {l.product.name} × {l.quantity}
              </span>
              <span>
                {formatBDT(l.product.price * l.quantity)}
              </span>
            </div>
          ))}

          <div>
            <span>Subtotal</span>
            <span>{formatBDT(subtotal)}</span>
          </div>

          {/* Coupon Section */}
          <div className="cart-coupon">
            <h3>Have a coupon?</h3>

            <div className="cart-coupon-input">
              <input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setApplied(null);
                  setCouponMsg('');
                  clearCartCoupon();
                }}
                placeholder="Enter coupon code"
                aria-label="Coupon code"
              />

              <button
                type="button"
                className="button"
                onClick={applyCoupon}
                disabled={couponBusy || !code.trim()}
              >
                {couponBusy ? 'Checking…' : 'Apply'}
              </button>
            </div>

            {couponMsg && (
              <small className={applied ? 'success-note' : 'err'}>
                {couponMsg}
              </small>
            )}

            {applied && (
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
              <span>Discount ({applied?.code})</span>
              <span>−{formatBDT(discount)}</span>
            </div>
          )}

          <div>
            <span>Delivery</span>
            <span>
              {delivery === 0 ? 'Free' : formatBDT(delivery)}
            </span>
          </div>

          <div className="cart-total">
            <span>Total</span>
            <span>{formatBDT(total)}</span>
          </div>

          {stockError && (
            <small role="alert" className="err">
              {stockError}
            </small>
          )}

          <button
            className="button button-orange"
            type="submit"
            disabled={placing || couponBusy}
          >
            {placing ? 'Placing order…' : 'Place order'}
          </button>

          <Link href="/cart" className="text-link">
            Back to bag
          </Link>
        </aside>
      </form>
    </main>
  );
}
