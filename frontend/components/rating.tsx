import { Star } from 'lucide-react';
export function Rating({ value, count }: { value: number; count?: number }) {
  return (
    <span className="rating" aria-label={`Rated ${value} out of 5`}>
      <span className="stars">{[1, 2, 3, 4, 5].map((n) => <Star key={n} size={14} fill={n <= Math.round(value) ? 'currentColor' : 'none'} />)}</span>
      <b>{value.toFixed(1)}</b>{count !== undefined && <small>({count})</small>}
    </span>
  );
}
