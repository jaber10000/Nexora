
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.security import current_user, admin_user
from app.database.session import get_db
from app.models import User, Product, RecentlyViewed
from app.services.recently_viewed import (
    track_product_view,
    get_recently_viewed,
)

router = APIRouter(
    prefix="/api/recently-viewed",
    tags=["Recently Viewed"]
)


@router.post("/{product_id}")
def track_view(
    product_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    product = db.get(Product, product_id)

    if not product or not product.is_active:
        raise HTTPException(404, "Product not found")

    track_product_view(db, user.id, product_id)

    return {
        "success": True,
        "message": "Product view tracked successfully"
    }


@router.get("")
def list_recently_viewed(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    products = get_recently_viewed(db, user.id)

    result = []

    for product in products:
        result.append({
            "id": product.id,
            "name": product.name,
            "category": product.category,
            "price": product.price,
            "oldPrice": product.old_price,
            "image": product.image,
            "description": product.description,
            "stock": product.stock,
            "tag": product.tag,
        })

    return {
        "total": len(result),
        "items": result
    }


@router.delete("/{product_id}")
def remove_recently_viewed(
    product_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    item = db.scalar(
        select(RecentlyViewed).where(
            RecentlyViewed.user_id == user.id,
            RecentlyViewed.product_id == product_id
        )
    )

    if item:
        db.delete(item)
        db.commit()

    return {
        "success": True,
        "message": "Product removed from history"
    }


@router.delete("")
def clear_recently_viewed(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    items = db.scalars(
        select(RecentlyViewed).where(
            RecentlyViewed.user_id == user.id
        )
    ).all()

    for item in items:
        db.delete(item)

    db.commit()

    return {
        "success": True,
        "message": "Recently viewed history cleared"
    }


# Admin analytics
@router.get("/admin/most-viewed")
def most_viewed_products(
    admin: User = Depends(admin_user),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        select(
            Product.id,
            Product.name,
            Product.category,
            Product.image,
            func.count(RecentlyViewed.id).label("view_count")
        )
        .join(
            RecentlyViewed,
            RecentlyViewed.product_id == Product.id
        )
        .where(Product.is_active.is_(True))
        .group_by(
            Product.id,
            Product.name,
            Product.category,
            Product.image
        )
        .order_by(func.count(RecentlyViewed.id).desc())
        .limit(20)
    ).all()

    return {
        "items": [
            {
                "productId": row.id,
                "name": row.name,
                "category": row.category,
                "image": row.image,
                "views": row.view_count,
            }
            for row in rows
        ]
    }
