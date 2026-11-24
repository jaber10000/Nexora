'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type CartItem = { id: number; quantity: number };

type Store = {
  items: CartItem[];
  count: number;
  addToCart: (id: number, quantity?: number) => void;
  removeFromCart: (id: number) => void;
  setQuantity: (id: number, quantity: number) => void;
  clearCart: () => void;
  ready: boolean;
  // Wishlist: saved in localStorage (demo)
  wishlist: number[];
  toggleWishlist: (id: number) => void;
  inWishlist: (id: number) => boolean;
};

const StoreContext = createContext<Store | null>(null);
const CART_KEY = 'nexora-cart';
const WISH_KEY = 'nexora-wishlist';
const MAX_QTY = 99;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [wishlist, setWishlist] = useState<number[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_KEY);
      if (saved) setItems(JSON.parse(saved));
      const w = localStorage.getItem(WISH_KEY);
      if (w) setWishlist(JSON.parse(w));
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {}
  }, [items, ready]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(WISH_KEY, JSON.stringify(wishlist));
    } catch {}
  }, [wishlist, ready]);

  const addToCart = useCallback((id: number, quantity = 1) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nexora:toast', { detail: { text: 'Added to your bag', href: '/cart', cta: 'View bag' } }));
    }
    setItems((prev) => {
      const found = prev.find((i) => i.id === id);
      if (found) {
        return prev.map((i) =>
          i.id === id ? { ...i, quantity: Math.min(MAX_QTY, i.quantity + quantity) } : i,
        );
      }
      return [...prev, { id, quantity: Math.min(MAX_QTY, quantity) }];
    });
  }, []);

  const removeFromCart = useCallback((id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const setQuantity = useCallback((id: number, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.id !== id)
        : prev.map((i) => (i.id === id ? { ...i, quantity: Math.min(MAX_QTY, quantity) } : i)),
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const toggleWishlist = useCallback((id: number) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nexora:toast', { detail: { text: 'Wishlist updated', href: '/wishlist', cta: 'View' } }));
    }
    setWishlist((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const value = useMemo<Store>(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.quantity, 0),
      addToCart,
      removeFromCart,
      setQuantity,
      clearCart,
      ready,
      wishlist,
      toggleWishlist,
      inWishlist: (id: number) => wishlist.includes(id),
    }),
    [items, ready, wishlist, addToCart, removeFromCart, setQuantity, clearCart, toggleWishlist],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
