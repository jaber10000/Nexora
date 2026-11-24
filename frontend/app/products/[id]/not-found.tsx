import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="inner-page">
      <div className="page-intro">
        <span className="eyebrow">404</span>
        <h1>Product <em>not found.</em></h1>
        <p>This product may have been removed or the link is incorrect.</p>
        <Link href="/products" className="button button-orange" style={{ marginTop: 28 }}>
          Back to shop
        </Link>
      </div>
    </main>
  );
}
