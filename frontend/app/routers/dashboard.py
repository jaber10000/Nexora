"""Admin dashboard analytics: one endpoint that returns everything the /admin page needs.

GET /api/admin/dashboard?start=YYYY-MM-DD&end=YYYY-MM-DD   (admin only)

Conventions
- Dates are interpreted in the store's local time (settings.store_utc_offset_hours, default +6 = Asia/Dhaka);
  `orders.created_at` is stored as naive UTC.
- "Revenue" and "orders" exclude Cancelled orders (same rule as /api/admin/stats). The status breakdown
  includes every status so cancellations stay visible.
- Product images are deliberately NOT returned (they can be large data: URIs) - the dashboard doesn't need them.
"""
from collections import defaultdict
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import Integer, desc, func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import admin_user
from app.database.session import get_db
from app.models import Order, OrderItem, Product

router = APIRouter(prefix="/api/admin/dashboard", tags=["Admin"], dependencies=[Depends(admin_user)])

LOW_STOCK = 8          # keep in sync with LOW_STOCK in frontend/lib/stock.ts
MAX_RANGE_DAYS = 366
STATUSES = ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"]
_OFFSET = timedelta(hours=settings.store_utc_offset_hours)


def _local_today() -> date:
    return (datetime.utcnow() + _OFFSET).date()


def _utc_bounds(first: date, last: date) -> tuple[datetime, datetime]:
    """Inclusive local-date range -> [lo, hi) as naive UTC datetimes."""
    return datetime.combine(first, time.min) - _OFFSET, datetime.combine(last + timedelta(days=1), time.min) - _OFFSET


def _local_date(dt: datetime) -> date:
    return (dt + _OFFSET).date()


def _change(cur: int, prev: int) -> float | None:
    """% change vs previous period; None when there is nothing to compare against."""
    return None if prev == 0 else round((cur - prev) / prev * 100, 1)


def _live_totals(db: Session, lo: datetime, hi: datetime) -> tuple[int, int]:
    """(revenue, order count) for non-cancelled orders in [lo, hi)."""
    rev, n = db.execute(
        select(func.coalesce(func.sum(Order.total), 0), func.count(Order.id))
        .where(Order.created_at >= lo, Order.created_at < hi, Order.status != "Cancelled")
    ).one()
    return int(rev), int(n)


@router.get("")
def dashboard(start: date | None = None, end: date | None = None, db: Session = Depends(get_db)):
    today = _local_today()
    end = end or today
    start = start or end - timedelta(days=29)
    if start > end:
        raise HTTPException(400, "Start date must be on or before the end date.")
    days = (end - start).days + 1
    if days > MAX_RANGE_DAYS:
        raise HTTPException(400, f"Please choose a range of at most {MAX_RANGE_DAYS} days.")

    lo, hi = _utc_bounds(start, end)
    prev_end = start - timedelta(days=1)
    prev_lo, prev_hi = _utc_bounds(prev_end - timedelta(days=days - 1), prev_end)

    # ---- orders in range (light column select, no item loading)
    rows = db.execute(
        select(Order.created_at, Order.total, Order.status, Order.phone)
        .where(Order.created_at >= lo, Order.created_at < hi)
    ).all()

    by_day: dict[date, list[int]] = defaultdict(lambda: [0, 0])   # date -> [orders, revenue]
    status_count: dict[str, int] = defaultdict(int)
    buyers: set[str] = set()
    revenue = orders = 0
    for created_at, total, status, phone in rows:
        status_count[status] += 1
        if status == "Cancelled":
            continue
        d = by_day[_local_date(created_at)]
        d[0] += 1
        d[1] += total
        revenue += total
        orders += 1
        buyers.add(phone)

    trend = []
    for i in range(days):
        d = start + timedelta(days=i)
        o, r = by_day.get(d, (0, 0))
        trend.append({"date": d.isoformat(), "orders": o, "revenue": r})

    prev_revenue, prev_orders = _live_totals(db, prev_lo, prev_hi)

    # ---- today (always "today", whatever range is selected)
    t_lo, t_hi = _utc_bounds(today, today)
    today_sales, today_orders = _live_totals(db, t_lo, t_hi)

    # ---- last 12 calendar months (independent of the selected range)
    first_month = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
    for _ in range(10):
        first_month = (first_month - timedelta(days=1)).replace(day=1)
    m_lo, _ = _utc_bounds(first_month, first_month)
    monthly_map: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for created_at, total in db.execute(
        select(Order.created_at, Order.total).where(Order.created_at >= m_lo, Order.status != "Cancelled")
    ):
        m = monthly_map[_local_date(created_at).strftime("%Y-%m")]
        m[0] += 1
        m[1] += total
    monthly, cur = [], first_month
    for _ in range(12):
        key = cur.strftime("%Y-%m")
        o, r = monthly_map.get(key, (0, 0))
        monthly.append({"month": key, "orders": o, "revenue": r})
        cur = (cur.replace(day=28) + timedelta(days=4)).replace(day=1)

    # ---- best sellers in range
    units = func.sum(OrderItem.quantity)
    top = db.execute(
        select(OrderItem.product_id, func.max(OrderItem.name), units.label("units"), func.sum(OrderItem.price * OrderItem.quantity))
        .join(Order, Order.id == OrderItem.order_id)
        .where(Order.created_at >= lo, Order.created_at < hi, Order.status != "Cancelled", OrderItem.product_id.is_not(None))
        .group_by(OrderItem.product_id)
        .order_by(desc("units"))
        .limit(6)
    ).all()

    # ---- inventory snapshot
    inv = db.execute(
        select(
            func.count(Product.id),
            func.coalesce(func.sum((Product.stock <= 0).cast(Integer)), 0),
            func.coalesce(func.sum(((Product.stock > 0) & (Product.stock <= LOW_STOCK)).cast(Integer)), 0),
        ).where(Product.is_active)
    ).one()
    low_rows = db.execute(
        select(Product.id, Product.name, Product.category, Product.stock)
        .where(Product.is_active, Product.stock <= LOW_STOCK)
        .order_by(Product.stock, Product.name)
        .limit(20)
    ).all()

    recent = db.execute(
        select(Order.id, Order.name, Order.total, Order.status, Order.payment, Order.created_at)
        .order_by(Order.created_at.desc()).limit(8)
    ).all()
    customers_all = db.scalar(select(func.count(func.distinct(Order.phone)))) or 0

    return {
        "range": {"start": start.isoformat(), "end": end.isoformat(), "days": days},
        "kpis": {
            "revenue": revenue, "revenueChange": _change(revenue, prev_revenue),
            "orders": orders, "ordersChange": _change(orders, prev_orders),
            "avgOrderValue": round(revenue / orders) if orders else 0,
            "customers": customers_all, "customersInRange": len(buyers),
            "products": int(inv[0]), "outOfStock": int(inv[1]), "lowStock": int(inv[2]),
            "todaySales": today_sales, "todayOrders": today_orders,
            "pending": status_count.get("Pending", 0), "cancelled": status_count.get("Cancelled", 0),
        },
        "trend": trend,
        "monthly": monthly,
        "statuses": [{"status": s, "count": status_count.get(s, 0)} for s in STATUSES],
        "topProducts": [{"id": pid, "name": name, "units": int(u), "revenue": int(rev)} for pid, name, u, rev in top],
        "lowStock": [{"id": i, "name": n, "category": c, "stock": s} for i, n, c, s in low_rows],
        "recentOrders": [{"id": i, "customer": n, "total": t, "status": s, "payment": p, "createdAt": c.isoformat()} for i, n, t, s, p, c in recent],
    }
