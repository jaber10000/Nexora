'use client';
// Stock helpers, built on the catalog (lib/catalog.ts).
import { useCatalog } from '@/lib/catalog';

export const LOW_STOCK = 8;
export type StockStatus = 'in' | 'low' | 'out';
export const stockStatus = (n: number): StockStatus => (n <= 0 ? 'out' : n <= LOW_STOCK ? 'low' : 'in');
export const statusLabel: Record<StockStatus, string> = { in: 'In stock', low: 'Low stock', out: 'Out of stock' };

export function useStock() {
  const { items, setStock } = useCatalog();
  return { rows: items.map((p) => ({ ...p, stock: p.stock ?? 0 })), setStock };
}
