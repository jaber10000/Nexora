
'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import {
  Search,
  SlidersHorizontal,
  X,
  History,
  Sparkles,
} from 'lucide-react';

import { ProductCard } from '@/components/product-card';
import { useCatalog } from '@/lib/catalog';
import { useCategories } from '@/lib/admin-data';
import { formatBDT } from '@/lib/products';

type SortKey = 'newest' | 'popular' | 'best' | 'low' | 'high' | 'rating';

const HISTORY_KEY = 'nexora-search-history';

export default function ProductsPage() {
  const { items, ready, error, refresh } = useCatalog();
  const { names } = useCategories();

  // Mobile filter drawer (desktop shows the filters as a sidebar)
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Search and filter states
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState<SortKey>('newest');

  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [rating, setRating] = useState('0');

  const [inStock, setInStock] = useState(false);
  const [discounted, setDiscounted] = useState(false);
  const [newOnly, setNewOnly] = useState(false);

  // Search suggestions and history
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  const searchRef = useRef<HTMLDivElement>(null);

  // Load recent searches
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);

      if (raw) {
        const parsed: unknown = JSON.parse(raw);

        if (Array.isArray(parsed)) {
          setHistory(
            parsed
              .filter((item): item is string => typeof item === 'string')
              .slice(0, 8)
          );
        }
      }
    } catch {
      setHistory([]);
    }
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(e.target as Node)
      ) {
        setSuggestOpen(false);
      }
    };

    document.addEventListener('mousedown', onClick);

    return () => {
      document.removeEventListener('mousedown', onClick);
    };
  }, []);

  // Product price boundaries
  const priceBounds = useMemo(() => {
    if (!items.length) {
      return { min: 0, max: 0 };
    }

    return {
      min: Math.min(...items.map((p) => p.price)),
      max: Math.max(...items.map((p) => p.price)),
    };
  }, [items]);

  // Identify newest products
  const newIds = useMemo(() => {
    return new Set(
      [...items]
        .sort((a, b) => b.id - a.id)
        .slice(0, 8)
        .map((p) => p.id)
    );
  }, [items]);

  // Search suggestions
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return [];

    return items
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [items, query]);

  // Filter and sort products
  const filtered = useMemo(() => {
    return items
      .filter((p) => {
        const text = (
          p.name +
          ' ' +
          (p.description || '') +
          ' ' +
          p.category
        ).toLowerCase();

        const matchesSearch =
          !query.trim() || text.includes(query.trim().toLowerCase());

        const matchesCategory =
          category === 'All' || p.category === category;

        const matchesMinPrice =
          minPrice === '' || p.price >= Number(minPrice);

        const matchesMaxPrice =
          maxPrice === '' || p.price <= Number(maxPrice);

        const matchesRating =
          Number(rating) === 0 ||
          (p.ratingAvg || 0) >= Number(rating);

        const matchesStock =
          !inStock || (p.stock || 0) > 0;

        const matchesDiscount =
          !discounted ||
          (!!p.oldPrice && p.oldPrice > p.price);

        const matchesNew =
          !newOnly || newIds.has(p.id);

        return (
          matchesSearch &&
          matchesCategory &&
          matchesMinPrice &&
          matchesMaxPrice &&
          matchesRating &&
          matchesStock &&
          matchesDiscount &&
          matchesNew
        );
      })
      .sort((a, b) => {
        switch (sort) {
          case 'low':
            return a.price - b.price;

          case 'high':
            return b.price - a.price;

          case 'rating':
            return (b.ratingAvg || 0) - (a.ratingAvg || 0);

          case 'popular':
            return (b.viewCount || 0) - (a.viewCount || 0);

          case 'best':
            return (b.soldCount || 0) - (a.soldCount || 0);

          case 'newest':
          default:
            return b.id - a.id;
        }
      });
  }, [
    items,
    query,
    category,
    sort,
    minPrice,
    maxPrice,
    rating,
    inStock,
    discounted,
    newOnly,
    newIds,
  ]);

  // Save search history
  const saveSearch = (term: string) => {
    const clean = term.trim();

    if (!clean) return;

    const next = [
      clean,
      ...history.filter(
        (x) => x.toLowerCase() !== clean.toLowerCase()
      ),
    ].slice(0, 8);

    setHistory(next);

    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // Ignore localStorage errors
    }

    setQuery(clean);
    setSuggestOpen(false);
  };

  // Clear all filters
  const clearFilters = () => {
    setCategory('All');
    setMinPrice('');
    setMaxPrice('');
    setRating('0');
    setInStock(false);
    setDiscounted(false);
    setNewOnly(false);
    setSort('newest');
  };

  const hasFilters =
    category !== 'All' ||
    minPrice !== '' ||
    maxPrice !== '' ||
    rating !== '0' ||
    inStock ||
    discounted ||
    newOnly;

  return (
    <main className="inner-page shop-page">
      {/* Page Introduction */}
      <div className="page-intro">
        <span className="eyebrow">THE NEXORA COLLECTION</span>

        <h1>
          Shop all <em>good things.</em>
        </h1>

        <p>Considered essentials for every part of your day.</p>
      </div>

      {/* Search, Category and Sorting */}
      <div className="catalog-tools catalog-tools-enhanced">
        <div className="search-suggest-wrap" ref={searchRef}>
          <label className="search-box">
            <Search size={18} />

            <input
              value={query}
              onFocus={() => setSuggestOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setSuggestOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveSearch(query);
                if (e.key === 'Escape') setSuggestOpen(false);
              }}
              placeholder="Search name, details, category..."
            />

            <button
              type="button"
              className="search-clear"
              aria-label="Clear search"
              onClick={() => {
                setQuery('');
                setSuggestOpen(true);
              }}
            >
              <X size={15} />
            </button>
          </label>

          {/* Search Suggestions */}
          {suggestOpen && (
            <div className="search-suggestions">
              {query.trim() ? (
                <>
                  <p className="suggestion-heading">Suggestions</p>

                  {suggestions.length > 0 ? (
                    suggestions.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="suggestion-item"
                        onClick={() => saveSearch(p.name)}
                      >
                        <span
                          className="suggestion-image"
                          style={{
                            backgroundImage: `url("${p.image}")`,
                          }}
                        />

                        <span>
                          <strong>{p.name}</strong>

                          <small>
                            {p.category} · {formatBDT(p.price)}
                          </small>
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="suggestion-empty">
                      No matching products
                    </p>
                  )}

                  <button
                    type="button"
                    className="suggestion-search-all"
                    onClick={() => saveSearch(query)}
                  >
                    Search for “{query}”
                  </button>
                </>
              ) : history.length > 0 ? (
                <>
                  <div className="suggestion-heading-row">
                    <p className="suggestion-heading">
                      <History size={13} />
                      Recent searches
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        setHistory([]);
                        localStorage.removeItem(HISTORY_KEY);
                      }}
                    >
                      Clear
                    </button>
                  </div>

                  {history.map((term) => (
                    <button
                      key={term}
                      type="button"
                      className="history-item"
                      onClick={() => {
                        setQuery(term);
                        setSuggestOpen(false);
                      }}
                    >
                      <History size={14} />
                      {term}
                    </button>
                  ))}
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* Category Filter */}
        <label className="filter-box">
          <SlidersHorizontal size={17} />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="All">All</option>

            {names.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        {/* Sorting */}
        <select
          className="sort-select"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
        >
          <option value="newest">Newest first</option>
          <option value="popular">Most viewed</option>
          <option value="best">Best sellers</option>
          <option value="low">Price: low to high</option>
          <option value="high">Price: high to low</option>
          <option value="rating">Top rated</option>
        </select>

        <button
          type="button"
          className="filter-toggle"
          onClick={() => setFiltersOpen(true)}
          aria-expanded={filtersOpen}
        >
          <SlidersHorizontal size={16} /> Filters{hasFilters ? ' •' : ''}
        </button>
      </div>

      <button
        type="button"
        className={filtersOpen ? 'filter-scrim open' : 'filter-scrim'}
        aria-label="Close filters"
        onClick={() => setFiltersOpen(false)}
      />

      {/* Advanced Filter Panel */}
      <section className={filtersOpen ? 'catalog-filter-panel open' : 'catalog-filter-panel'} aria-label="Product filters">
        <div className="filter-panel-title">
          <span>
            <SlidersHorizontal size={15} />
            Filter products
          </span>

          {hasFilters && (
            <button type="button" onClick={clearFilters}>
              Clear all
            </button>
          )}

          <button
            type="button"
            className="filter-drawer-close"
            aria-label="Close filters"
            onClick={() => setFiltersOpen(false)}
          >
            <X size={16} />
          </button>
        </div>

        <div className="filter-panel-grid">
          {/* Price Filter */}
          <div className="price-filter">
            <label>Price range</label>

            <div className="price-inputs">
              <input
                type="number"
                min="0"
                placeholder={`${priceBounds.min}`}
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                aria-label="Minimum price"
              />

              <span>to</span>

              <input
                type="number"
                min="0"
                placeholder={`${priceBounds.max}`}
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                aria-label="Maximum price"
              />
            </div>

            <div className="price-range-pair">
              <label>
                Min

                <input
                  type="range"
                  min={priceBounds.min}
                  max={priceBounds.max || priceBounds.min + 1}
                  value={
                    minPrice === ''
                      ? priceBounds.min
                      : Math.max(
                          priceBounds.min,
                          Math.min(Number(minPrice), priceBounds.max)
                        )
                  }
                  onChange={(e) => setMinPrice(e.target.value)}
                />

                <strong>
                  {formatBDT(
                    minPrice === ''
                      ? priceBounds.min
                      : Number(minPrice)
                  )}
                </strong>
              </label>

              <label>
                Max

                <input
                  type="range"
                  min={priceBounds.min}
                  max={priceBounds.max || priceBounds.min + 1}
                  value={
                    maxPrice === ''
                      ? priceBounds.max
                      : Math.max(
                          priceBounds.min,
                          Math.min(Number(maxPrice), priceBounds.max)
                        )
                  }
                  onChange={(e) => setMaxPrice(e.target.value)}
                />

                <strong>
                  {formatBDT(
                    maxPrice === ''
                      ? priceBounds.max
                      : Number(maxPrice)
                  )}
                </strong>
              </label>
            </div>
          </div>

          {/* Rating Filter */}
          <label className="rating-filter">
            Rating

            <select
              value={rating}
              onChange={(e) => setRating(e.target.value)}
            >
              <option value="0">Any rating</option>
              <option value="4">4★ & above</option>
              <option value="3">3★ & above</option>
              <option value="2">2★ & above</option>
            </select>
          </label>

          {/* Stock Filter */}
          <label className="check-filter">
            <input
              type="checkbox"
              checked={inStock}
              onChange={(e) => setInStock(e.target.checked)}
            />
            In stock only
          </label>

          {/* Discount Filter */}
          <label className="check-filter">
            <input
              type="checkbox"
              checked={discounted}
              onChange={(e) => setDiscounted(e.target.checked)}
            />
            Discounted products
          </label>

          {/* New Arrivals Filter */}
          <label className="check-filter">
            <input
              type="checkbox"
              checked={newOnly}
              onChange={(e) => setNewOnly(e.target.checked)}
            />

            <Sparkles size={14} />
            New arrivals
          </label>
        </div>
      </section>

      {/* Product Results */}
      <p className="result-count">
        {ready ? filtered.length : items.length} PRODUCTS
      </p>

      {!ready && (
        <div className="product-grid" aria-busy="true" aria-label="Loading products">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i}>
              <span className="skeleton" style={{ aspectRatio: '4 / 5' }} />
              <span className="skeleton" style={{ height: 14, width: '70%', marginTop: 14 }} />
              <span className="skeleton" style={{ height: 14, width: '40%', marginTop: 8 }} />
            </div>
          ))}
        </div>
      )}

      {/* API Error */}
      {ready && error && items.length === 0 && (
        <section className="empty-state">
          <p>We couldn’t connect to the product catalog.</p>

          <p>{error}</p>

          <p>
            Make sure the NEXORA backend is running at the API URL
            configured in frontend/.env.local.
          </p>

          <button
            type="button"
            className="btn"
            onClick={() => refresh()}
          >
            Try again
          </button>
        </section>
      )}

      {/* Product Grid */}
      {ready && !error && (
        <div className="product-grid">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      {/* Empty Results */}
      {ready && !error && filtered.length === 0 && (
        <p className="empty-state">
          No products match these filters. Try adjusting your search.
        </p>
      )}
    </main>
  );
}
