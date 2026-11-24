'use client';
// Product image slider: slides sit side by side in a scroll-snap track (swipe, arrows, dots, thumbnails).
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function ProductGallery({ images, name, tag }: { images: string[]; name: string; tag?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const many = images.length > 1;

  const go = useCallback((i: number) => {
    const el = track.current;
    if (!el) return;
    const n = Math.max(0, Math.min(images.length - 1, i));
    el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' });
    setIndex(n);
  }, [images.length]);

  // Keep the active dot in sync when the user swipes / scrolls.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setIndex(0); track.current?.scrollTo({ left: 0 }); }, [images.join('|').length]);

  return (
    <div className="pd-gallery" aria-roledescription="carousel" aria-label={`${name} images`}>
      <div className="pd-slider">
        <div className="pd-track" ref={track} tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'ArrowRight') go(index + 1); if (e.key === 'ArrowLeft') go(index - 1); }}>
          {images.map((src, i) => (
            <div className="pd-slide" key={i} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${images.length}`}
              style={{ backgroundImage: `url('${src}')` }} />
          ))}
        </div>
        {tag && <span className="product-tag">{tag}</span>}
        {many && (
          <>
            <button type="button" className="pd-arrow prev" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous image"><ChevronLeft size={20} /></button>
            <button type="button" className="pd-arrow next" onClick={() => go(index + 1)} disabled={index === images.length - 1} aria-label="Next image"><ChevronRight size={20} /></button>
            <span className="pd-count">{index + 1} / {images.length}</span>
          </>
        )}
      </div>
      {many && (
        <div className="pd-thumbs">
          {images.map((src, i) => (
            <button type="button" key={i} className={i === index ? 'active' : ''} onClick={() => go(i)} aria-label={`Show image ${i + 1}`} aria-current={i === index}
              style={{ backgroundImage: `url('${src}')` }} />
          ))}
        </div>
      )}
    </div>
  );
}
