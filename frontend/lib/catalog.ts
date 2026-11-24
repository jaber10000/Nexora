'use client';
// Product catalog backed by the FastAPI backend. One shared in-memory cache so the shop,
// cart, checkout and every admin screen see the same data and update together.
import { useCallback, useEffect, useState } from 'react';
import type { Product } from '@/lib/products';
import { api } from '@/lib/api';

type Raw = Omit<Product, 'oldPrice' | 'tag' | 'description' | 'features' | 'images'> & { oldPrice: number | null; tag: string | null; description: string | null; features: string[] | null; images: string[] | null };
const clean = (r: Raw): Product => ({ ...r, oldPrice: r.oldPrice ?? undefined, tag: r.tag ?? undefined, description: r.description ?? undefined, features: r.features ?? undefined, images: r.images ?? undefined });

let cache: Product[] = [];
let loaded = false;
let loadError: string | null = null;
let inflight: Promise<void> | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const set = (next: Product[]) => { cache = next; emit(); };

export function refreshCatalog(): Promise<void> {
  inflight ??= api<Raw[]>('/api/products')
    .then((rows) => { cache = rows.map(clean); loadError = null; loaded = true; emit(); })
    .catch((error) => { loadError = error instanceof Error ? error.message : 'Could not load products.'; loaded = true; emit(); })
    .finally(() => { inflight = null; });
  return inflight;
}

export const categories = ['Technology', 'Accessories', 'Lifestyle', 'Home'];

const body = (p: Omit<Product, 'id'>) => ({ ...p, images: p.images?.length ? p.images : null, oldPrice: p.oldPrice ?? null, tag: p.tag ?? null, description: p.description ?? null, features: p.features ?? null, stock: p.stock ?? 0 });
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export function useCatalog() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    subs.add(f);
    if (!loaded) refreshCatalog();
    return () => { subs.delete(f); };
  }, []);

  // Throws on failure (e.g. not signed in as admin) so the calling page can show the message.
  const save = useCallback(async (p: Omit<Product, 'id'> & { id?: number }) => {
    const saved = clean(p.id
      ? await api<Raw>(`/api/products/${p.id}`, { method: 'PUT', body: body(p) })
      : await api<Raw>('/api/products', { method: 'POST', body: body(p) }));
    set(p.id ? cache.map((x) => (x.id === saved.id ? saved : x)) : [...cache, saved]);
  }, []);

  const remove = useCallback(async (id: number) => {
    await api(`/api/products/${id}`, { method: 'DELETE' });
    set(cache.filter((x) => x.id !== id));
  }, []);

  // Optimistic + debounced so typing in the inventory field doesn't spam the API.
  const setStock = useCallback((id: number, qty: number) => {
    const stock = Math.max(0, Math.min(9999, Math.floor(qty) || 0));
    set(cache.map((x) => (x.id === id ? { ...x, stock } : x)));
    clearTimeout(timers.get(id));
    timers.set(id, setTimeout(() => {
      api(`/api/products/${id}/stock`, { method: 'PATCH', body: { stock } }).catch(() => refreshCatalog());
    }, 400));
  }, []);

  const getProduct = (id: number) => cache.find((x) => x.id === id);
  return { items: cache, ready: loaded, error: loadError, getProduct, save, remove, setStock, refresh: refreshCatalog };
}

// Resize a chosen image to max 800px JPEG (keeps the stored data small).
export function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Please choose an image file (JPG, PNG or WebP).'));
    if (file.size > 5 * 1024 * 1024) return reject(new Error('Image is too large — max 5 MB.'));
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Could not read this file.'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('This image could not be opened.'));
      img.onload = () => {
        const s = Math.min(1, 800 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(fr.result);
    };
    fr.readAsDataURL(file);
  });
}
