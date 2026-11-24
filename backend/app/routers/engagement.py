from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import admin_user, current_user, optional_user
from app.database.session import get_db
from app.models import Product, Review, User, WishlistItem
from app.schemas import ReviewIn, WishlistMergeIn
from app.services import reviews as rv

wishlist = APIRouter(prefix="/api/wishlist", tags=["Wishlist"], dependencies=[Depends(current_user)])  # auth required
product_reviews = APIRouter(prefix="/api/products", tags=["Reviews"])
reviews = APIRouter(prefix="/api/reviews", tags=["Reviews"])
admin_reviews = APIRouter(prefix="/api/admin/reviews", tags=["Reviews"])


# ---------------------------------------------------------------- wishlist
def _ids(db: Session, user: User) -> list[int]:
    """Product ids, newest first; products an admin has since removed are skipped."""
    q = (
        select(WishlistItem.product_id)
        .join(Product, Product.id == WishlistItem.product_id)
        .where(WishlistItem.user_id == user.id, Product.is_active)
        .order_by(WishlistItem.created_at.desc(), WishlistItem.id.desc())
    )
    return list(db.scalars(q))


def _add(db: Session, user: User, pid: int) -> None:
    if db.scalar(select(WishlistItem.id).where(WishlistItem.user_id == user.id, WishlistItem.product_id == pid)):
        return
    try:
        with db.begin_nested():
            db.add(WishlistItem(user_id=user.id, product_id=pid))
    except IntegrityError:  # double-click / two tabs raced us: already saved, which is the goal
        pass


@wishlist.get("")
def get_wishlist(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return {"ids": _ids(db, user)}


@wishlist.post("/merge")
def merge_wishlist(b: WishlistMergeIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Called once after sign-in to move a guest's local favourites into the account."""
    valid = set(db.scalars(select(Product.id).where(Product.id.in_(set(b.ids)), Product.is_active)))
    for pid in b.ids:
        if pid in valid:
            _add(db, user, pid)
    db.commit()
    return {"ids": _ids(db, user)}


@wishlist.post("/{pid}", status_code=201)
def add_to_wishlist(pid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = db.get(Product, pid)
    if not p or not p.is_active:
        raise HTTPException(404, "Product not found.")
    _add(db, user, pid)
    db.commit()
    return {"ids": _ids(db, user)}


@wishlist.delete("/{pid}")
def remove_from_wishlist(pid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.execute(delete(WishlistItem).where(WishlistItem.user_id == user.id, WishlistItem.product_id == pid))
    db.commit()
    return {"ids": _ids(db, user)}


# ---------------------------------------------------------------- reviews (public read, verified-buyer write)
def _summary(db: Session, pid: int) -> dict:
    avg, n = rv.summaries(db, [pid]).get(pid, (0.0, 0))
    return {"average": avg, "count": n, "distribution": rv.distribution(db, pid)}


@product_reviews.get("/{pid}/reviews")
def list_reviews(pid: int, limit: int = Query(10, ge=1, le=50), offset: int = Query(0, ge=0),
                 user: User | None = Depends(optional_user), db: Session = Depends(get_db)):
    p = db.get(Product, pid)
    if not p or not p.is_active:
        raise HTTPException(404, "Product not found.")
    rows = db.execute(
        select(Review, User).join(User, User.id == Review.user_id, isouter=True)
        .where(Review.product_id == pid, Review.approved.is_(True)).order_by(Review.created_at.desc(), Review.id.desc()).limit(limit).offset(offset)
    ).all()
    mine = db.scalar(select(Review).where(Review.product_id == pid, Review.user_id == user.id)) if user else None
    return {
        **_summary(db, pid),
        "items": [rv.review_out(r, u) for r, u in rows],
        "viewer": {
            "signedIn": user is not None,
            "canReview": bool(user) and mine is None and rv.has_purchased(db, user.id, pid),
            "myReview": rv.review_out(mine, user) if mine else None,
        },
    }


@product_reviews.post("/{pid}/reviews", status_code=201)
def create_review(pid: int, b: ReviewIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = db.get(Product, pid)
    if not p or not p.is_active:
        raise HTTPException(404, "Product not found.")
    if not rv.has_purchased(db, user.id, pid):
        raise HTTPException(403, "You can review a product after your order for it has been delivered.")
    r = Review(product_id=pid, user_id=user.id, rating=b.rating, title=(b.title or "").strip() or None, comment=b.comment.strip())
    db.add(r)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "You have already reviewed this product. You can edit your review instead.")
    db.refresh(r)
    return rv.review_out(r, user)



@reviews.get("/recent")
def recent_reviews(limit: int = Query(12, ge=1, le=30), db: Session = Depends(get_db)):
    """Homepage feed of approved customer reviews with product names."""
    rows = db.execute(
        select(Review, User, Product.name).join(User, User.id == Review.user_id, isouter=True)
        .join(Product, Product.id == Review.product_id)
        .where(Review.approved.is_(True), Product.is_active.is_(True))
        .order_by(Review.created_at.desc(), Review.id.desc()).limit(limit)
    ).all()
    return {"items": [rv.review_out(r, u, product_name=n) for r, u, n in rows]}

@reviews.put("/{rid}")
def update_review(rid: int, b: ReviewIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    r = db.get(Review, rid)
    if not r or r.user_id != user.id:  # 404 for other people's reviews, like orders
        raise HTTPException(404, "Review not found.")
    r.rating, r.title, r.comment, r.updated_at = b.rating, (b.title or "").strip() or None, b.comment.strip(), datetime.utcnow()
    db.commit()
    return rv.review_out(r, user)


@reviews.delete("/{rid}", status_code=204)
def delete_review(rid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """The author can remove their own review; an administrator can remove any review."""
    r = db.get(Review, rid)
    if not r or (r.user_id != user.id and not user.is_admin):
        raise HTTPException(404, "Review not found.")
    db.delete(r)
    db.commit()


# ---------------------------------------------------------------- admin moderation
@admin_reviews.get("", dependencies=[Depends(admin_user)])
def admin_list_reviews(product_id: int | None = None, max_rating: int | None = Query(None, ge=1, le=5),
                       limit: int = Query(25, ge=1, le=100), offset: int = Query(0, ge=0), db: Session = Depends(get_db)):
    where = [c for c in (Review.product_id == product_id if product_id else None, Review.rating <= max_rating if max_rating else None) if c is not None]
    total = db.scalar(select(func.count(Review.id)).where(*where)) or 0
    rows = db.execute(
        select(Review, User, Product.name).join(User, User.id == Review.user_id, isouter=True).join(Product, Product.id == Review.product_id)
        .where(*where).order_by(Review.created_at.desc(), Review.id.desc()).limit(limit).offset(offset)
    ).all()
    return {"total": total, "items": [rv.review_out(r, u, product_name=n, admin_view=True) for r, u, n in rows]}
