
from sqlalchemy import select, delete
from sqlalchemy.orm import Session

from app.models import RecentlyViewed, Product


MAX_RECENT_PRODUCTS = 5


def track_product_view(db: Session, user_id: int, product_id: int):
    product = db.get(Product, product_id)

    if not product or not product.is_active:
        return None

    item = db.scalar(
        select(RecentlyViewed).where(
            RecentlyViewed.user_id == user_id,
            RecentlyViewed.product_id == product_id
        )
    )

    if item:
        item.viewed_at = __import__("datetime").datetime.utcnow()
    else:
        item = RecentlyViewed(
            user_id=user_id,
            product_id=product_id
        )
        db.add(item)

    db.flush()

    # Keep only the latest five products.
    old_ids = db.scalars(
        select(RecentlyViewed.id)
        .where(RecentlyViewed.user_id == user_id)
        .order_by(
            RecentlyViewed.viewed_at.desc(),
            RecentlyViewed.id.desc()
        )
        .offset(MAX_RECENT_PRODUCTS)
    ).all()

    if old_ids:
        db.execute(
            delete(RecentlyViewed).where(
                RecentlyViewed.id.in_(old_ids)
            )
        )

    db.commit()
    return item


def get_recently_viewed(db: Session, user_id: int):
    rows = db.execute(
        select(Product)
        .join(
            RecentlyViewed,
            RecentlyViewed.product_id == Product.id
        )
        .where(
            RecentlyViewed.user_id == user_id,
            Product.is_active.is_(True)
        )
        .order_by(
            RecentlyViewed.viewed_at.desc(),
            RecentlyViewed.id.desc()
        )
        .limit(MAX_RECENT_PRODUCTS)
    ).scalars().all()

    return rows
