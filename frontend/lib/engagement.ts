
import { api } from '@/lib/api';
import type { Product } from '@/lib/products';

// Recently viewed
export async function trackProductView(productId: number) {
  return api(`/api/recently-viewed/${productId}`, {
    method: 'POST',
  });
}

export async function fetchRecentlyViewed(): Promise<Product[]> {
  return api<{items: Product[]}>('/api/recently-viewed').then((r) => r.items || []);
}

export async function clearRecentlyViewed() {
  return api('/api/recently-viewed', { method: 'DELETE' });
}

// Loyalty
export type LoyaltyBalance = {
  points_balance: number;
  lifetime_points: number;
  current_tier?: string | null;
  tier?: string | null;
  free_delivery_until?: string | null;
};

export type LoyaltyOffer = {
  tier: string;
  required_points: number;
  benefits: string[];
  unlocked?: boolean;
  remaining_points?: number;
};

export type LoyaltyTransaction = {
  id: number;
  points: number;
  transaction_type: string;
  description?: string | null;
  created_at: string;
  order_id?: number | null;
};

export async function fetchLoyaltyBalance() {
  return api<LoyaltyBalance>('/api/loyalty/balance');
}

export async function fetchLoyaltyOffers() {
  return api<{offers: LoyaltyOffer[]; coupons?: {code:string;tier:string;redeemed:boolean}[]}>('/api/loyalty/offers').then((r) => r.offers || []);
}

export async function fetchLoyaltyHistory(): Promise<LoyaltyTransaction[]> {
  return api<{items: LoyaltyTransaction[]}>('/api/loyalty/history').then((r) => r.items || []);
}

export async function redeemLoyaltyPoints(points: number) {
  return api('/api/loyalty/redeem', {
    method: 'POST',
    body: { points },
  });
}
