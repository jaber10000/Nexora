
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.security import admin_user
from app.database.session import get_db
from app.models import (
    Category,
    Coupon,
    Product,
    Order,
    OrderItem,
    ProductViewEvent,
)
from app.schemas import (
    CategoryIn,
    CategoryOut,
    CouponCheckIn,
    CouponIn,
    CouponOut,
    ProductIn,
    ProductOut,
    StockIn,
)
from app.services.orders import evaluate_coupon, find_coupon
from app.services.reviews import summaries

products = APIRouter(prefix="/api/products", tags=["Products"])
categories = APIRouter(prefix="/api/categories", tags=["Categories"])
coupons = APIRouter(prefix="/api/coupons", tags=["Coupons"])


# ---------------- metrics

def _metrics(db: Session, ids: list[int]) -> dict[int, dict[str, int]]:
    if not ids:
        return {}

    sold_rows = db.execute(
        select(
            OrderItem.product_id,
            func.coalesce(func.sum(OrderItem.quantity), 0),
        )
        .join(Order, Order.id == OrderItem.order_id)
        .where(
            OrderItem.product_id.in_(ids),
            Order.status.in_(["Delivered", "Completed"]),
        )
        .group_by(OrderItem.product_id)
    ).all()

    view_rows = db.execute(
        select(
            ProductViewEvent.product_id,
            func.count(ProductViewEvent.id),
        )
        .where(ProductViewEvent.product_id.in_(ids))
        .group_by(ProductViewEvent.product_id)
    ).all()

    result = {
        pid: {"soldCount": int(count), "viewCount": 0}
        for pid, count in sold_rows
    }

    for pid, count in view_rows:
        result.setdefault(
            pid,
            {"soldCount": 0, "viewCount": 0},
        )["viewCount"] = int(count)

    return result


# ---------------- product serializer

def _p(
    p: Product,
    rating: tuple[float, int] = (0.0, 0),
    metrics: dict[str, int] | None = None,
) -> dict:

    metrics = metrics or {
        "soldCount": 0,
        "viewCount": 0,
    }

    return {
        "ratingAvg": rating[0],
        "reviewCount": rating[1],
        **metrics,
        "id": p.id,
        "name": p.name,
        "category": p.category,
        "price": p.price,
        "oldPrice": p.old_price,
        "tag": p.tag,
        "image": p.image,
        "description": p.description,
        "features": p.features,
        "images": p.images or ([p.image] if p.image else []),
        "stock": p.stock,
    }


# ---------------- products

@products.get("")
def list_products(db: Session = Depends(get_db)):
    rows = list(
        db.scalars(
            select(Product)
            .where(Product.is_active)
            .order_by(Product.id)
        )
    )

    stats = summaries(db)
    metrics = _metrics(db, [p.id for p in rows])

    return [
        _p(
            p,
            stats.get(p.id, (0.0, 0)),
            metrics.get(p.id),
        )
        for p in rows
    ]


@products.get("/{pid}")
def get_product(pid: int, db: Session = Depends(get_db)):
    p = db.get(Product, pid)

    if not p or not p.is_active:
        raise HTTPException(404, "Product not found.")

    metrics = _metrics(db, [pid]).get(pid)

    return _p(
        p,
        summaries(db, [pid]).get(pid, (0.0, 0)),
        metrics,
    )


def _apply(p: Product, b: ProductIn):
    p.name = b.name.strip()
    p.category = b.category
    p.price = b.price
    p.old_price = b.old_price
    p.tag = b.tag or None
    gallery = [i for i in (b.images or []) if i]
    p.images = gallery or None
    p.image = gallery[0] if gallery else b.image
    p.description = b.description
    p.features = b.features
    p.stock = b.stock


@products.post(
    "",
    status_code=201,
    dependencies=[Depends(admin_user)],
)
def create_product(b: ProductIn, db: Session = Depends(get_db)):
    p = Product()
    _apply(p, b)

    db.add(p)
    db.commit()
    db.refresh(p)

    return _p(p)


@products.put(
    "/{pid}",
    dependencies=[Depends(admin_user)],
)
def update_product(pid: int, b: ProductIn, db: Session = Depends(get_db)):
    p = db.get(Product, pid)

    if not p:
        raise HTTPException(404, "Product not found.")

    _apply(p, b)
    db.commit()
    db.refresh(p)

    return _p(p)


@products.patch(
    "/{pid}/stock",
    dependencies=[Depends(admin_user)],
)
def set_stock(pid: int, b: StockIn, db: Session = Depends(get_db)):
    p = db.get(Product, pid)

    if not p:
        raise HTTPException(404, "Product not found.")

    p.stock = b.stock
    db.commit()
    db.refresh(p)

    return _p(p)


@products.delete(
    "/{pid}",
    status_code=204,
    dependencies=[Depends(admin_user)],
)
def delete_product(pid: int, db: Session = Depends(get_db)):
    p = db.get(Product, pid)

    if p:
        p.is_active = False
        db.commit()


# ---------------- categories

@categories.get("", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.scalars(
        select(Category).order_by(Category.id)
    ).all()


@categories.post(
    "",
    response_model=CategoryOut,
    status_code=201,
    dependencies=[Depends(admin_user)],
)
def create_category(b: CategoryIn, db: Session = Depends(get_db)):
    if db.scalar(
        select(Category).where(Category.name == b.name.strip())
    ):
        raise HTTPException(
            409,
            "A category with this name already exists.",
        )

    c = Category(
        name=b.name.strip(),
        description=b.description,
    )

    db.add(c)
    db.commit()
    db.refresh(c)

    return c


@categories.put(
    "/{cid}",
    response_model=CategoryOut,
    dependencies=[Depends(admin_user)],
)
def update_category(cid: int, b: CategoryIn, db: Session = Depends(get_db)):
    c = db.get(Category, cid)

    if not c:
        raise HTTPException(404, "Category not found.")

    old = c.name
    c.name = b.name.strip()
    c.description = b.description

    if old != c.name:
        for p in db.scalars(
            select(Product).where(Product.category == old)
        ):
            p.category = c.name

    db.commit()
    db.refresh(c)

    return c


@categories.delete(
    "/{cid}",
    status_code=204,
    dependencies=[Depends(admin_user)],
)
def delete_category(cid: int, db: Session = Depends(get_db)):
    c = db.get(Category, cid)

    if c:
        db.delete(c)
        db.commit()


# ---------------- coupons

def _c(c: Coupon) -> dict:
    return {
        "id": c.id,
        "code": c.code,
        "type": c.type,
        "value": c.value,
        "minOrder": c.min_order,
        "limit": c.limit,
        "used": c.used,
        "expires": c.expires,
        "active": c.active,
    }


@coupons.get("", dependencies=[Depends(admin_user)])
def list_coupons(db: Session = Depends(get_db)):
    return [
        _c(c)
        for c in db.scalars(
            select(Coupon).order_by(Coupon.id)
        )
    ]


@coupons.post(
    "",
    status_code=201,
    dependencies=[Depends(admin_user)],
)
def create_coupon(b: CouponIn, db: Session = Depends(get_db)):
    code = b.code.strip().upper()

    if find_coupon(db, code):
        raise HTTPException(
            409,
            "This coupon code already exists.",
        )

    c = Coupon(
        code=code,
        type=b.type,
        value=b.value,
        min_order=b.min_order,
        limit=b.limit,
        expires=b.expires,
        active=b.active,
    )

    db.add(c)
    db.commit()
    db.refresh(c)

    return _c(c)


@coupons.put(
    "/{cid}",
    dependencies=[Depends(admin_user)],
)
def update_coupon(cid: int, b: CouponIn, db: Session = Depends(get_db)):
    c = db.get(Coupon, cid)

    if not c:
        raise HTTPException(404, "Coupon not found.")

    c.code = b.code.strip().upper()
    c.type = b.type
    c.value = b.value
    c.min_order = b.min_order
    c.limit = b.limit
    c.expires = b.expires
    c.active = b.active

    db.commit()
    db.refresh(c)

    return _c(c)


@coupons.delete(
    "/{cid}",
    status_code=204,
    dependencies=[Depends(admin_user)],
)
def delete_coupon(cid: int, db: Session = Depends(get_db)):
    c = db.get(Coupon, cid)

    if c:
        db.delete(c)
        db.commit()


@coupons.post("/check")
def check_coupon(b: CouponCheckIn, db: Session = Depends(get_db)):
    c, discount, err = evaluate_coupon(
        find_coupon(db, b.code),
        b.subtotal,
    )

    if err:
        return {
            "ok": False,
            "error": err,
        }

    return {
        "ok": True,
        "code": c.code,
        "discount": discount,
    }
