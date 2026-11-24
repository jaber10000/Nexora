// Order constants, types and API helpers. Orders are stored in the backend database.
export const FREE_DELIVERY_OVER = 5000;

export const shippingOptions = [
  { id: 'standard', label: 'Standard delivery', note: '3–5 working days', fee: 120, freeOver: true },
  { id: 'express', label: 'Express delivery', note: '1–2 working days', fee: 250, freeOver: false },
] as const;

export const paymentMethods = [
  { id: 'cod', label: 'Cash on Delivery', note: 'Pay in cash when your order arrives' },
  { id: 'bkash_p2p', label: 'bKash (Demo)', note: 'Dummy payment channel · manual transaction verification' },
  { id: 'nagad_p2p', label: 'Nagad (Demo)', note: 'Dummy payment channel · manual transaction verification' },
  { id: 'sslcommerz_demo', label: 'SSLCommerz (Demo)', note: 'Simulated checkout · no real payment gateway connected' },
] as const;

export type ShippingId = (typeof shippingOptions)[number]['id'];
export type PaymentId = (typeof paymentMethods)[number]['id'];

export type OrderLine = { id: number; name: string; image: string; price: number; quantity: number };
export type Order = {
  id: string;
  status?: AdminStatus;
  createdAt: string;
  lines: OrderLine[];
  subtotal: number;
  delivery: number;
  total: number;
  shipping: ShippingId;
  payment: PaymentId;
  email?: string;
  coupon?: string;
  discount?: number;
  address: { name: string; phone: string; address: string; area: string; district: string };
  invoiceNo?: string;
  paymentStatus?: PaymentStatus | 'pending_verification';
  paymentInfo?: Record<string, string | boolean> | null;
  courier?: string | null;
  trackingNumber?: string | null;
  cancelReason?: string | null;
  cancelledBy?: 'customer' | 'admin' | null;
  cancelledAt?: string | null;
  refund?: Refund | null;
  timeline?: OrderEvent[];
  canCancel?: boolean;
  canRequestRefund?: boolean;
  refundBlockReason?: string | null;
  userId?: number | null; // admin responses only
};

export type PaymentStatus = 'Unpaid' | 'Paid' | 'Refunded' | 'Partially Refunded' | 'pending_verification';
export type Refund = {
  status: 'Requested' | 'Refunded' | 'Rejected';
  reason?: string | null; amount: number; method?: string | null; note?: string | null;
  requestedAt?: string | null; refundedAt?: string | null;
};
export type OrderEvent = {
  id: number; kind: 'placed' | 'status' | 'payment' | 'cancel' | 'refund' | 'note'; title: string; note?: string | null;
  status?: AdminStatus | null; actor: 'system' | 'customer' | 'admin'; at: string;
};

export const trackingSteps = ['Order placed', 'Confirmed', 'Packed', 'Shipped', 'Delivered'] as const;

import { api, downloadFile } from '@/lib/api';

export type AdminStatus = 'Pending' | 'Confirmed' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';
const STEP: Record<AdminStatus, number> = { Pending: 0, Confirmed: 1, Processing: 2, Shipped: 3, Delivered: 4, Cancelled: 0 };
export const statusStep = (s: AdminStatus) => STEP[s] ?? 0;

export type PlaceOrderInput = {
  lines: { id: number; quantity: number }[];
  shipping: ShippingId;
  payment: PaymentId;
  coupon?: string;
  address: Order['address'];
  payment_info?: Record<string, string | boolean>;
};
// Prices, delivery fee, discount and stock are all re-checked on the server.
export const placeOrder = (input: PlaceOrderInput) => api<Order>('/api/orders', { method: 'POST', body: input });
export const fetchMyOrders = () => api<Order[]>('/api/orders/mine');
export const fetchOrder = (id: string) => api<Order>(`/api/orders/${encodeURIComponent(id)}`);
export const cancelMyOrder = (id: string, reason: string) => api<Order>(`/api/orders/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: { reason } });
export const requestRefund = (id: string, reason: string) => api<Order>(`/api/orders/${encodeURIComponent(id)}/refund-request`, { method: 'POST', body: { reason } });
/** Downloads the order's PDF invoice (needs the sign-in token, so it can't be a plain link). */
export const downloadInvoice = (id: string) => downloadFile(`/api/orders/${encodeURIComponent(id)}/invoice`, `invoice-${id}.pdf`);

export const cancelReasons = ['Ordered by mistake', 'Found a better price', 'Delivery is too slow', 'Want to change the items or address', 'No longer need it'] as const;
export const refundReasons = ['Item arrived damaged', 'Wrong item received', 'Not as described', 'Quality is not what I expected', 'Item is defective'] as const;
export const checkCouponApi = (code: string, subtotal: number) =>
  api<{ ok: true; code: string; discount: number } | { ok: false; error: string }>('/api/coupons/check', { method: 'POST', body: { code, subtotal } });
