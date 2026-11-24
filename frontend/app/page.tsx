import { RecentlyViewed } from '@/components/recently-viewed';
import Link from 'next/link';
import {
  ArrowUpRight,
  ArrowRight,
  Truck,
  ShieldCheck,
  RotateCcw,
  Banknote,
} from 'lucide-react';
import { Rating } from '@/components/rating';
import { HomeReviews } from '@/components/home-reviews';

import { FeaturedProducts } from '@/components/featured-products';

// -----------------------------------------------------------------------------
// Data
// -----------------------------------------------------------------------------

const categories = [
  {
    name: 'Technology',
    image:
      'https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=900&q=85',
    number: '01',
  },
  {
    name: 'Style & Accessories',
    image:
      'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=85',
    number: '02',
  },
  {
    name: 'Home & Living',
    image:
      'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=85',
    number: '03',
  },
];

const trustFeatures = [
  { label: 'Free delivery over ৳5,000', sub: 'Across Bangladesh', icon: Truck },
  { label: '7-day easy returns', sub: 'No questions asked', icon: RotateCcw },
  { label: 'Cash on delivery', sub: 'Pay when it arrives', icon: Banknote },
  { label: 'Secure payments', sub: 'bKash, Nagad & cards', icon: ShieldCheck },
];

// -----------------------------------------------------------------------------
// Reusable Components
// -----------------------------------------------------------------------------

function SectionHeading({
  title,
  description,
  href,
  linkLabel,
}: {
  title: string;
  description?: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {description && <p className="muted">{description}</p>}
      </div>

      <Link href={href} className="text-link">
        {linkLabel}
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Hero Section
// -----------------------------------------------------------------------------

function HeroSection() {
  return (
    <section className="hero">
      <div className="hero-copy">
        <h1>
          Discover the
          <br />
          <em>Extraordinary</em>
        </h1>

        <p>
          Premium products. Better living. Thoughtful picks for work, home
          and everywhere in between, delivered across Bangladesh.
        </p>

        <div className="hero-actions">
          <Link href="/products" className="button button-orange">
            Shop now
            <ArrowRight size={16} />
          </Link>

          <a href="#story" className="text-link light-link">
            About NEXORA
          </a>
        </div>
      </div>

      <div className="hero-visual">
        <div className="hero-photo" role="img" aria-label="Premium wireless headphones" />
        <div className="floating-note">
          <strong>Shop smarter.<br />Live better.</strong>
          <span className="note-index">Curated essentials, fair prices</span>
        </div>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Trust Section
// -----------------------------------------------------------------------------

function TrustSection() {
  return (
    <section className="trust-strip">
      {trustFeatures.map(({ label, sub, icon: Icon }) => (
        <div key={label}>
          <Icon size={22} aria-hidden="true" />
          <span><b>{label}</b><small>{sub}</small></span>
        </div>
      ))}
    </section>
  );
}

// -----------------------------------------------------------------------------
// Categories Section
// -----------------------------------------------------------------------------

function CategoriesSection() {
  return (
    <section className="section categories-section" id="categories">
      <SectionHeading
        title="Shop by category"
        description="Explore our top categories."
        href="/products"
        linkLabel="View all"
      />

      <div className="category-grid">
        {categories.map(({ name, image, number }) => (
          <Link
            href="/products"
            className="category-card"
            key={number}
            aria-label={`Explore ${name}`}
          >
            <div
              className="category-photo"
              style={{ backgroundImage: `url('${image}')` }}
            />

            <div className="category-caption">
              <span>{name}</span>

              <ArrowUpRight size={20} aria-hidden="true" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Featured Products Section
// -----------------------------------------------------------------------------

function ProductsSection() {
  return (
    <>
      <section className="section products-section">
        <SectionHeading
          title="Featured products"
          description="Handpicked for you."
          href="/products"
          linkLabel="View all"
        />
        <FeaturedProducts mode="trending" />
      </section>

      <section className="section">
        <SectionHeading
          title="New arrivals"
          description="Just landed in the store."
          href="/products"
          linkLabel="View all"
        />
        <FeaturedProducts mode="new" />
      </section>

      <section className="section products-section">
        <SectionHeading
          title="Best sellers"
          description="What our customers keep coming back for."
          href="/products"
          linkLabel="View all"
        />
        <FeaturedProducts mode="best" />
      </section>
    </>
  );
}

// -----------------------------------------------------------------------------
// Promotional Banners
// -----------------------------------------------------------------------------

function PromoSection() {
  return (
    <section className="section">
      <div className="promo-grid">
        <div
          className="promo"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=1400&q=80')" }}
        >
          <h3>Tools that make every day easier.</h3>
          <p>Browse the latest gadgets and accessories, with cash on delivery.</p>
          <Link href="/products" className="button">
            Shop technology <ArrowRight size={16} />
          </Link>
        </div>

        <div
          className="promo alt"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=80')" }}
        >
          <h3>Make your space feel considered.</h3>
          <Link href="/products" className="button">
            Explore home <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Brand Story Section
// -----------------------------------------------------------------------------

function StorySection() {
  return (
    <section className="story-band" id="story">
      <div className="story-image" />

      <div className="story-copy">
        <h2>
          Good things,
          <br />
          <em>no fuss.</em>
        </h2>

        <p>
          NEXORA brings useful finds across technology, style and
          home into one simple place. We believe shopping should
          feel clear, considered and easy.
        </p>

        <Link href="/portfolio" className="button button-light">
          Meet the maker
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Newsletter Section
// -----------------------------------------------------------------------------

function NewsletterSection() {
  return (
    <section className="newsletter">
      <h2>
        Get product drops
        <br />
        <em>before everyone else.</em>
      </h2>

      <p>
        Product drops, thoughtful finds and occasional good news.
      </p>

      <form
        action="mailto:hello@nexora.example"
        method="get"
      >
        <input
          aria-label="Email address"
          type="email"
          name="email"
          placeholder="Your email address"
          required
        />

        <button type="submit" aria-label="Subscribe">
          <ArrowUpRight size={20} />
        </button>
      </form>

      <small>
        By subscribing, you agree to receive occasional updates.
      </small>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Homepage
// -----------------------------------------------------------------------------

export default function HomePage() {
  return (
    <main>
      <HeroSection />

      <TrustSection />

      <CategoriesSection />

      <ProductsSection />

      <RecentlyViewed />

      <PromoSection />

      <StorySection />

      <HomeReviews />

      <NewsletterSection />
    </main>
  );
}
