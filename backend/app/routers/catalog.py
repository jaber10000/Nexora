from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import admin_user
from app.database.session import get_db
from app.models import Category, Coupon, Product
from app.schemas import CategoryIn, CategoryOut, CouponCheckIn, CouponIn, CouponOut, ProductIn, ProductOut, StockIn
from app.services.orders import evaluate_coupon, find_coupon
from app.services.reviews import summaries

products = APIRouter(prefix="/api/products", tags=["Products"])
categories = APIRouter(prefix="/api/categories", tags=["Categories"])
coupons = APIRouter(prefix="/api/coupons", tags=["Coupons"])


def _p(p: Product, rating: tuple[float, int] = (0.0, 0)) -> dict:
    return {"ratingAvg": rating[0], "reviewCount": rating[1], "id": p.id, "name": p.name, "category": p.category, "price": p.price, "oldPrice": p.old_price, "tag": p.tag,
            "image": p.image, "description": p.description, "features": p.features, "stock": p.stock}


# ---------------- products
@products.get("")
def list_products(db: Session = Depends(get_db)):
    rows = list(db.scalars(select(Product).where(Product.is_active).order_by(Product.id)))
    stats = summaries(db)  # one grouped query for every product's average + count
    return [_p(p, stats.get(p.id, (0.0, 0))) for p in rows]


@products.get("/{pid}")
def get_product(pid: int, db: Session = Depends(get_db)):
    p = db.get(Product, pid)
    if not p or not p.is_active:
        raise HTTPException(404, "Product not found.")
    return _p(p, summaries(db, [pid]).get(pid, (0.0, 0)))


def _apply(p: Product, b: ProductIn):
    p.name, p.category, p.price, p.old_price, p.tag = b.name.strip(), b.category, b.price, b.old_price, (b.tag or None)
    p.image, p.description, p.features, p.stock = b.image, b.description, b.features, b.stock


@products.post("", status_code=201, dependencies=[Depends(admin_user)])
def create_product(b: ProductIn, db: Session = Depends(get_db)):
    p = Product()
    _apply(p, b)
    db.add(p)
    db.commit()
    db.refresh(p)
    return _p(p)


@products.put("/{pid}", dependencies=[Depends(admin_user)])
def update_product(pid: int, b: ProductIn, db: Session = Depends(get_db)):
    p = db.get(Product, pid)
    if not p:
        raise HTTPException(404, "Product not found.")
    _apply(p, b)
    db.commit()
    return _p(p)


@products.patch("/{pid}/stock", dependencies=[Depends(admin_user)])
def set_stock(pid: int, b: StockIn, db: Session = Depends(get_db)):
    p = db.get(Product, pid)
    if not p:
        raise HTTPException(404, "Product not found.")
    p.stock = b.stock
    db.commit()
    return _p(p)


@products.delete("/{pid}", status_code=204, dependencies=[Depends(admin_user)])
def delete_product(pid: int, db: Session = Depends(get_db)):
    p = db.get(Product, pid)
    if p:
        p.is_active = False  # soft delete keeps old orders intact
        db.commit()


# ---------------- categories
@categories.get("", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.scalars(select(Category).order_by(Category.id)).all()


@categories.post("", response_model=CategoryOut, status_code=201, dependencies=[Depends(admin_user)])
def create_category(b: CategoryIn, db: Session = Depends(get_db)):
    if db.scalar(select(Category).where(Category.name == b.name.strip())):
        raise HTTPException(409, "A category with this name already exists.")
    c = Category(name=b.name.strip(), description=b.description)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@categories.put("/{cid}", response_model=CategoryOut, dependencies=[Depends(admin_user)])
def update_category(cid: int, b: CategoryIn, db: Session = Depends(get_db)):
    c = db.get(Category, cid)
    if not c:
        raise HTTPException(404, "Category not found.")
    old = c.name
    c.name, c.description = b.name.strip(), b.description
    if old != c.name:  # keep products attached to the renamed category
        for p in db.scalars(select(Product).where(Product.category == old)):
            p.category = c.name
    db.commit()
    return c


@categories.delete("/{cid}", status_code=204, dependencies=[Depends(admin_user)])
def delete_category(cid: int, db: Session = Depends(get_db)):
    c = db.get(Category, cid)
    if c:
        db.delete(c)
        db.commit()


# ---------------- coupons
def _c(c: Coupon) -> dict:
    return {"id": c.id, "code": c.code, "type": c.type, "value": c.value, "minOrder": c.min_order, "limit": c.limit,
            "used": c.used, "expires": c.expires, "active": c.active}


@coupons.get("", dependencies=[Depends(admin_user)])
def list_coupons(db: Session = Depends(get_db)):
    return [_c(c) for c in db.scalars(select(Coupon).order_by(Coupon.id))]


@coupons.post("", status_code=201, dependencies=[Depends(admin_user)])
def create_coupon(b: CouponIn, db: Session = Depends(get_db)):
    code = b.code.strip().upper()
    if find_coupon(db, code):
        raise HTTPException(409, "This coupon code already exists.")
    c = Coupon(code=code, type=b.type, value=b.value, min_order=b.min_order, limit=b.limit, expires=b.expires, active=b.active)
    db.add(c)
    db.commit()
    db.refresh(c)
    return _c(c)


@coupons.put("/{cid}", dependencies=[Depends(admin_user)])
def update_coupon(cid: int, b: CouponIn, db: Session = Depends(get_db)):
    c = db.get(Coupon, cid)
    if not c:
        raise HTTPException(404, "Coupon not found.")
    c.code, c.type, c.value, c.min_order = b.code.strip().upper(), b.type, b.value, b.min_order
    c.limit, c.expires, c.active = b.limit, b.expires, b.active
    db.commit()
    return _c(c)


@coupons.delete("/{cid}", status_code=204, dependencies=[Depends(admin_user)])
def delete_coupon(cid: int, db: Session = Depends(get_db)):
    c = db.get(Coupon, cid)
    if c:
        db.delete(c)
        db.commit()


@coupons.post("/check")
def check_coupon(b: CouponCheckIn, db: Session = Depends(get_db)):
    c, discount, err = evaluate_coupon(find_coupon(db, b.code), b.subtotal)
    if err:
        return {"ok": False, "error": err}
    return {"ok": True, "code": c.code, "discount": discount}
