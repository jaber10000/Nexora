"""Rating aggregates and the purchase rule for reviews."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Order, OrderItem, Review, User

# Only delivered orders unlock reviews (change to a tuple/`in_` if you also want Shipped).
REVIEWABLE_STATUS = "Delivered"


def has_purchased(db: Session, user_id: int, product_id: int) -> bool:
    q = (
        select(OrderItem.id)
        .join(Order, Order.id == OrderItem.order_id)
        .where(Order.user_id == user_id, OrderItem.product_id == product_id, Order.status == REVIEWABLE_STATUS)
        .limit(1)
    )
    return db.scalar(q) is not None


def summaries(db: Session, product_ids: list[int] | None = None) -> dict[int, tuple[float, int]]:
    """{product_id: (average, count)} computed in ONE grouped query (no N+1 on the product list)."""
    q = select(Review.product_id, func.avg(Review.rating), func.count(Review.id)).where(Review.approved.is_(True)).group_by(Review.product_id)
    if product_ids is not None:
        q = q.where(Review.product_id.in_(product_ids))
    return {pid: (round(float(avg), 1), int(n)) for pid, avg, n in db.execute(q)}


def distribution(db: Session, product_id: int) -> dict[str, int]:
    rows = dict(db.execute(select(Review.rating, func.count(Review.id)).where(Review.product_id == product_id, Review.approved.is_(True)).group_by(Review.rating)).all())
    return {str(s): int(rows.get(s, 0)) for s in (5, 4, 3, 2, 1)}


def public_name(name: str) -> str:
    """'Ayesha Rahman' -> 'Ayesha R.' so full names are not exposed publicly."""
    parts = name.strip().split()
    return parts[0] if len(parts) < 2 else f"{parts[0]} {parts[-1][0]}."


def review_out(r: Review, user: User | None, product_name: str | None = None, admin_view: bool = False) -> dict:
    out = {
        "id": r.id, "productId": r.product_id, "rating": r.rating, "title": r.title, "comment": r.comment,
        "author": public_name(user.name) if user else "Deleted user",
        "createdAt": r.created_at.isoformat() if r.created_at else None,
        "edited": r.updated_at is not None,
    }
    if product_name is not None:
        out["productName"] = product_name
    if admin_view and user:
        out["authorEmail"] = user.email
    return out
