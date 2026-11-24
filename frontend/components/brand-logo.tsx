import Link from 'next/link';

// NEXORA geometric "N" monogram + wordmark. Inline SVG so it inherits crisp scaling
// and needs no network request. `light` is the white version for dark backgrounds.
export function BrandMark({ size = 32, light = false }: { size?: number; light?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path d="M8 8h13l35 48H43L21 25v31H8z" fill={light ? '#6F93FF' : '#315CFF'} />
      <path d="M43 8h13v48H43z" fill={light ? '#FFFFFF' : '#17212B'} />
    </svg>
  );
}

export function BrandLogo({ name = 'NEXORA', light = false, size = 32, href = '/', onClick, className = '' }: {
  name?: string; light?: boolean; size?: number; href?: string | null; onClick?: () => void; className?: string;
}) {
  const inner = (
    <>
      <BrandMark size={size} light={light} />
      <span className="brand-word">{name.toUpperCase()}</span>
    </>
  );
  const cls = `brand ${light ? 'brand-light' : ''} ${className}`.trim();
  return href === null
    ? <span className={cls}>{inner}</span>
    : <Link href={href} className={cls} onClick={onClick} aria-label={`${name} home`}>{inner}</Link>;
}
