"""Creates tables and inserts starter data. Safe to run repeatedly: `python -m app.seed`."""
from datetime import datetime, timedelta
from sqlalchemy import inspect, select, text

from app.core.config import settings
from app.core.security import hash_password
from app.database.session import Base, SessionLocal, engine
from app.models import Category, Coupon, Order, OrderEvent, Product, User, LoyaltyAccount

IMG = lambda i: f"https://images.unsplash.com/{i}?auto=format&fit=crop&w=900&q=85"

PRODUCTS = [
    ("Studio Wireless Headphones", "Technology", 4850, 5600, "Bestseller", "photo-1505740420928-5e560c06d30e",
     "Warm, balanced sound with active noise reduction and a soft-touch headband made for long working days and longer commutes.",
     ["Up to 30 hours battery", "Bluetooth 5.3", "Foldable design", "Built-in microphone"], 12),
    ("Everyday Carry Watch", "Accessories", 3250, None, "New", "photo-1523275335684-37898b6baf30",
     "A clean, understated watch with a scratch-resistant face and a strap that gets better with wear.",
     ["Water resistant", "Stainless steel case", "Genuine leather strap", "1 year warranty"], 8),
    ("Minimal Form Backpack", "Lifestyle", 2190, None, None, "photo-1553062407-98eeb64c6a62",
     "A slim, structured backpack with a padded laptop sleeve and just enough pockets to stay organised.",
     ['Fits 15" laptop', "Water-repellent fabric", "Padded shoulder straps", "Hidden back pocket"], 20),
    ("Soft Glow Desk Lamp", "Home", 1790, None, None, "photo-1507473885765-e6ed057f782c",
     "A warm, dimmable desk lamp that keeps your workspace comfortable without the harsh glare.",
     ["3 brightness levels", "Warm white light", "Flexible neck", "Energy efficient LED"], 15),
    ("Everyday Camera", "Technology", 12900, None, None, "photo-1516035069371-29a1b244cc32",
     "A compact camera that is simple enough for everyday moments and capable enough for when it matters.",
     ["24MP sensor", "Full HD video", "Wi-Fi transfer", "Rechargeable battery"], 5),
    ("Classic Leather Tote", "Accessories", 2850, None, None, "photo-1590874103328-eac38a683ce7",
     "A roomy everyday tote in soft leather, with an interior zip pocket and reinforced handles.",
     ["Genuine leather", "Interior zip pocket", "Magnetic closure", "Roomy main compartment"], 10),
]
CATEGORIES = [
    ("Technology", "Headphones, speakers, smart gadgets and everyday tech."),
    ("Accessories", "Bags, wallets, watches and carry essentials."),
    ("Lifestyle", "Wellness, fitness and daily-living products."),
    ("Home", "Decor, lighting and kitchen pieces for a calmer home."),
]
COUPONS = [("WELCOME10", "percent", 10, 1500, 500, 0, "2027-12-31", True), ("WINTER15", "percent", 15, 3000, 300, 0, "2027-01-31", True),
           ("EID200", "fixed", 200, 2500, 200, 200, "2026-06-30", False)]


# columns added to `orders` by the order-management module (create_all never alters existing tables)
ORDER_COLUMNS = {
    "payment_status": "VARCHAR(20) DEFAULT 'Unpaid'", "courier": "VARCHAR(60)", "tracking_number": "VARCHAR(80)",
    "cancel_reason": "VARCHAR(300)", "cancelled_by": "VARCHAR(10)", "cancelled_at": "TIMESTAMP",
    "refund_status": "VARCHAR(20)", "refund_reason": "VARCHAR(300)", "refund_amount": "INTEGER DEFAULT 0",
    "refund_method": "VARCHAR(40)", "refund_note": "VARCHAR(300)", "refund_requested_at": "TIMESTAMP", "refunded_at": "TIMESTAMP",
}
STATUS_TITLE = {"Confirmed": "Order confirmed", "Processing": "Packed and being prepared", "Shipped": "Shipped",
                "Delivered": "Delivered", "Cancelled": "Order cancelled"}


def migrate_orders() -> None:
    have = {c["name"] for c in inspect(engine).get_columns("orders")}
    with engine.begin() as conn:
        for col, ddl in ORDER_COLUMNS.items():
            if col not in have:
                conn.execute(text(f"ALTER TABLE orders ADD COLUMN {col} {ddl}"))
        conn.execute(text("UPDATE orders SET payment_status = 'Unpaid' WHERE payment_status IS NULL"))
        conn.execute(text("UPDATE orders SET refund_amount = 0 WHERE refund_amount IS NULL"))
    # give orders that pre-date order tracking a starting timeline
    with SessionLocal() as db:
        have_events = set(db.scalars(select(OrderEvent.order_id).distinct()))
        for o in db.scalars(select(Order)):
            if o.id in have_events:
                continue
            db.add(OrderEvent(order_id=o.id, kind="placed", title="Order placed", status="Pending", actor="system", created_at=o.created_at))
            if o.status in STATUS_TITLE:
                db.add(OrderEvent(order_id=o.id, kind="cancel" if o.status == "Cancelled" else "status", title=STATUS_TITLE[o.status],
                                  note="Recorded before detailed tracking was added.", status=o.status, actor="system", created_at=o.created_at))
            if o.status == "Delivered" and o.payment_status != "Paid":
                o.payment_status = "Paid"
        db.commit()


def run() -> None:
    Base.metadata.create_all(engine)
    # create_all never alters existing tables, so add columns introduced later (safe to repeat)
    if "phone" not in {c["name"] for c in inspect(engine).get_columns("users")}:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN phone VARCHAR(20)"))
    migrate_orders()
    # Add fields introduced by engagement/loyalty updates to existing installations.
    loyalty_columns = {c["name"] for c in inspect(engine).get_columns("loyalty_accounts")} if inspect(engine).has_table("loyalty_accounts") else set()
    with engine.begin() as conn:
        if "platinum_free_delivery_until" not in loyalty_columns:
            conn.execute(text("ALTER TABLE loyalty_accounts ADD COLUMN platinum_free_delivery_until TIMESTAMP"))
    # Backfill columns introduced by newer product/review features. create_all()
    # does not modify tables that already exist, so old local databases need migrations.
    product_columns = {c["name"] for c in inspect(engine).get_columns("products")}
    product_migrations = {
        "category": "VARCHAR(80) NOT NULL DEFAULT ''",
        "old_price": "INTEGER",
        "tag": "VARCHAR(40)",
        "image": "TEXT NOT NULL DEFAULT ''",
        "description": "TEXT",
        "features": "JSON",
        "images": "JSON",
        "stock": "INTEGER NOT NULL DEFAULT 0",
        "is_active": "BOOLEAN NOT NULL DEFAULT 1",
    }
    with engine.begin() as conn:
        for col, ddl in product_migrations.items():
            if col not in product_columns:
                conn.execute(text(f"ALTER TABLE products ADD COLUMN {col} {ddl}"))

    # Reviews need approval status for public-rating aggregates. Older DBs may
    # have the review table but not this field, which made /api/products 500.
    review_columns = {c["name"] for c in inspect(engine).get_columns("reviews")} if inspect(engine).has_table("reviews") else set()
    with engine.begin() as conn:
        if "title" not in review_columns:
            conn.execute(text("ALTER TABLE reviews ADD COLUMN title VARCHAR(120)"))
        if "updated_at" not in review_columns:
            conn.execute(text("ALTER TABLE reviews ADD COLUMN updated_at TIMESTAMP"))
        if "approved" not in review_columns:
            conn.execute(text("ALTER TABLE reviews ADD COLUMN approved BOOLEAN NOT NULL DEFAULT 1"))
    with SessionLocal() as db:
        # Existing members who had already crossed Platinum receive the migrated
        # 30-day free-delivery window from the upgrade date.
        for account in db.scalars(select(LoyaltyAccount).where(LoyaltyAccount.lifetime_points >= 1500, LoyaltyAccount.platinum_free_delivery_until.is_(None))):
            account.platinum_free_delivery_until = datetime.utcnow() + timedelta(days=30)
        for email, name, pw, admin in [(settings.admin_email, "Admin", settings.admin_password, True),
                                       (settings.demo_email, "Demo", settings.demo_password, False)]:
            existing = db.scalar(select(User).where(User.email == email.lower()))
            if not existing:
                db.add(User(name=name, email=email.lower(), password_hash=hash_password(pw), is_admin=admin))
            elif admin and not existing.is_admin:
                # The admin e-mail was registered as a normal customer earlier -> that account got 403 on every
                # admin endpoint. Re-assert the role on every start so the configured admin always works.
                existing.is_admin = True
                print(f"Promoted {existing.email} to administrator.")
        if not db.scalar(select(Category)):
            db.add_all(Category(name=n, description=d) for n, d in CATEGORIES)
        if not db.scalar(select(Product)):
            for n, c, p, o, t, i, d, f, s in PRODUCTS:
                db.add(Product(name=n, category=c, price=p, old_price=o, tag=t, image=IMG(i), description=d, features=f, stock=s))
        if not db.scalar(select(Coupon)):
            db.add_all(Coupon(code=a, type=b, value=c, min_order=d, limit=e, used=f, expires=g, active=h) for a, b, c, d, e, f, g, h in COUPONS)
        db.commit()
    print("Database ready.")


if __name__ == "__main__":
    run()
