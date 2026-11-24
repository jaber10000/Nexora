
const KEY = 'nexora-applied-coupon';

export function saveCartCoupon(code: string) {
  try {
    localStorage.setItem(KEY, code);
  } catch {}
}

export function getCartCoupon(): string {
  try {
    return localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}

export function clearCartCoupon() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
