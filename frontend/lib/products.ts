export type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  oldPrice?: number;
  tag?: string;
  image: string;
  images?: string[];   // gallery, first one is the cover (falls back to `image`)
  description?: string;
  features?: string[];
  stock?: number;
  ratingAvg?: number;   // average of all reviews (0 when none)
  reviewCount?: number;
  soldCount?: number;
  viewCount?: number;
};

export const galleryOf = (p: Pick<Product, 'image' | 'images'>): string[] => {
  const list = (p.images ?? []).filter(Boolean);
  return list.length ? list : p.image ? [p.image] : [];
};

export const formatBDT = (n: number) => `৳${n.toLocaleString('en-BD')}`;
