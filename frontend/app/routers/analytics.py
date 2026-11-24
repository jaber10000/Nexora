"""Admin analytics: revenue, sales, orders, customers, inventory and coupon analytics in one request.

GET /api/admin/analytics?start=YYYY-MM-DD&end=YYYY-MM-DD   (admin only)

Conventions (same as dashboard.py)
- Dates are store-local (settings.store_utc_offset_hours); orders.created_at is naive UTC.
- Revenue / orders / customers exclude Cancelled orders. The status breakdown includes every status.
- A "customer" is identified by phone number (same rule as the dashboard KPIs).
- Product revenue = unit price x quantity (before order-level coupon discounts).
- Range-dependent: daily/orders-per-day, sales, status, division map, new-vs-returning, top customers, coupon usage.
  Range-independent: monthly (last 12 months), yearly, customer growth, inventory, coupon list.
"""
from collections import defaultdict
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.core.security import admin_user
from app.database.session import get_db
from app.models import Coupon, Order, OrderItem, Product
from app.services.orders import is_sale
from app.routers.dashboard import (
    LOW_STOCK, MAX_RANGE_DAYS, STATUSES, _local_date, _local_today, _utc_bounds,
)

router = APIRouter(prefix="/api/admin/analytics", tags=["Admin"], dependencies=[Depends(admin_user)])

# Checkout offers these "districts"; the map groups them into Bangladesh's 8 divisions.
DIVISIONS = ["Dhaka", "Chattogram", "Sylhet", "Rajshahi", "Khulna", "Barishal", "Rangpur", "Mymensingh"]
DISTRICT_TO_DIVISION = {
    "Dhaka": "Dhaka", "Gazipur": "Dhaka", "Narayanganj": "Dhaka",
    "Chattogram": "Chattogram", "Cumilla": "Chattogram",
    "Sylhet": "Sylhet", "Rajshahi": "Rajshahi", "Khulna": "Khulna",
    "Barishal": "Barishal", "Rangpur": "Rangpur", "Mymensingh": "Mymensingh",
}


def _month_key(d: date) -> str:
    return d.strftime("%Y-%m")


def _next_month(d: date) -> date:
    return (d.replace(day=28) + timedelta(days=4)).replace(day=1)


@router.get("")
def analytics(start: date | None = None, end: date | None = None, db: Session = Depends(get_db)):
    today = _local_today()
    end = end or today
    start = start or end - timedelta(days=29)
    if start > end:
        raise HTTPException(400, "Start date must be on or before the end date.")
    days = (end - start).days + 1
    if days > MAX_RANGE_DAYS:
        raise HTTPException(400, f"Please choose a range of at most {MAX_RANGE_DAYS} days.")
    lo, hi = _utc_bounds(start, end)

    # ------------------------------------------------------------------ one pass over all live orders
    live = db.execute(
        select(Order.created_at, Order.total, Order.discount, Order.coupon, Order.phone, Order.name, Order.district)
        .where(is_sale())
        .order_by(Order.created_at)
    ).all()

    yearly_map: dict[int, list[int]] = defaultdict(lambda: [0, 0])
    monthly_map: dict[str, list[int]] = defaultdict(lambda: [0, 0, 0])      # orders, revenue, discount
    first_seen: dict[str, date] = {}                                         # phone -> first order (local date)
    by_day: dict[date, list[int]] = defaultdict(lambda: [0, 0])
    spend: dict[str, dict] = {}
    division: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    district: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    coupon_use: dict[str, list[int]] = defaultdict(lambda: [0, 0, 0])        # uses, discount, revenue
    buyers_in_range: set[str] = set()
    month_buyers: dict[str, set[str]] = defaultdict(set)
    revenue = orders = discount_total = coupon_orders = 0

    for created_at, total, discount, coupon, phone, name, dist in live:
        d = _local_date(created_at)
        discount = discount or 0
        y = yearly_map[d.year]; y[0] += 1; y[1] += total
        m = monthly_map[_month_key(d)]; m[0] += 1; m[1] += total; m[2] += discount
        month_buyers[_month_key(d)].add(phone)
        first_seen.setdefault(phone, d)

        if lo <= created_at < hi:
            by_day[d][0] += 1; by_day[d][1] += total
            revenue += total; orders += 1; discount_total += discount
            buyers_in_range.add(phone)
            s = spend.setdefault(phone, {"name": name, "orders": 0, "spent": 0})
            s["name"] = name; s["orders"] += 1; s["spent"] += total
            dv = division[DISTRICT_TO_DIVISION.get(dist, "Other")]; dv[0] += 1; dv[1] += total
            dd = district[dist or "Other"]; dd[0] += 1; dd[1] += total
            if coupon:
                coupon_orders += 1
                c = coupon_use[coupon]; c[0] += 1; c[1] += discount; c[2] += total

    # ------------------------------------------------------------------ revenue
    daily = []
    for i in range(days):
        d = start + timedelta(days=i)
        o, r = by_day.get(d, (0, 0))
        daily.append({"date": d.isoformat(), "orders": o, "revenue": r})

    first_month = today.replace(day=1)
    for _ in range(11):
        first_month = (first_month - timedelta(days=1)).replace(day=1)
    months, cur = [], first_month
    for _ in range(12):
        months.append(cur)
        cur = _next_month(cur)

    monthly = [{"month": _month_key(m), "orders": monthly_map[_month_key(m)][0] if _month_key(m) in monthly_map else 0,
                "revenue": monthly_map[_month_key(m)][1] if _month_key(m) in monthly_map else 0} for m in months]

    years = sorted(yearly_map) or [today.year]
    yearly = [{"year": str(y), "orders": yearly_map[y][0] if y in yearly_map else 0,
               "revenue": yearly_map[y][1] if y in yearly_map else 0} for y in range(years[0], today.year + 1)]

    # ------------------------------------------------------------------ sales (by product, in range)
    qty = func.sum(OrderItem.quantity)
    rev = func.sum(OrderItem.price * OrderItem.quantity)
    prod_rows = db.execute(
        select(OrderItem.product_id, func.max(OrderItem.name), qty, rev, func.max(Product.category))
        .join(Order, Order.id == OrderItem.order_id)
        .join(Product, Product.id == OrderItem.product_id, isouter=True)
        .where(Order.created_at >= lo, Order.created_at < hi, is_sale())
        .group_by(OrderItem.product_id, OrderItem.name)
    ).all()
    products_sold: dict = {}
    for pid, name, units, revenue_p, category in prod_rows:
        key = pid if pid is not None else f"n:{name}"
        p = products_sold.setdefault(key, {"id": pid, "name": name, "category": category or "Uncategorised", "units": 0, "revenue": 0})
        p["units"] += int(units); p["revenue"] += int(revenue_p)
    plist = list(products_sold.values())
    cat_map: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for p in plist:
        c = cat_map[p["category"]]; c[0] += p["units"]; c[1] += p["revenue"]
    categories = sorted(({"category": k, "units": v[0], "revenue": v[1]} for k, v in cat_map.items()), key=lambda x: -x["revenue"])[:8]

    # ------------------------------------------------------------------ orders
    status_count: dict[str, int] = defaultdict(int)
    for (status, n) in db.execute(
        select(Order.status, func.count(Order.id)).where(Order.created_at >= lo, Order.created_at < hi).group_by(Order.status)
    ):
        status_count[status] = int(n)
    statuses = [{"status": s, "count": status_count.get(s, 0)} for s in STATUSES]

    divisions = [{"division": dv, "orders": division[dv][0] if dv in division else 0, "revenue": division[dv][1] if dv in division else 0}
                 for dv in DIVISIONS]
    if "Other" in division:
        divisions.append({"division": "Other", "orders": division["Other"][0], "revenue": division["Other"][1]})
    districts = sorted(({"district": k, "orders": v[0], "revenue": v[1]} for k, v in district.items()), key=lambda x: -x["orders"])

    # ------------------------------------------------------------------ customers
    new_c = sum(1 for p in buyers_in_range if first_seen[p] >= start)
    returning_c = len(buyers_in_range) - new_c
    customer_monthly, running = [], sum(1 for d in first_seen.values() if d < months[0])
    for m in months:
        key = _month_key(m)
        new_m = sum(1 for d in first_seen.values() if _month_key(d) == key)
        ret_m = sum(1 for p in month_buyers.get(key, ()) if _month_key(first_seen[p]) < key)
        running += new_m
        customer_monthly.append({"month": key, "new": new_m, "returning": ret_m, "total": running})
    top_customers = sorted(
        ({"name": v["name"], "phone": k, "orders": v["orders"], "spent": v["spent"]} for k, v in spend.items()),
        key=lambda x: -x["spent"],
    )[:8]

    # ------------------------------------------------------------------ inventory (active products)
    inv = db.execute(
        select(Product.id, Product.name, Product.category, Product.stock).where(Product.is_active).order_by(Product.stock, Product.name)
    ).all()
    inventory_all = [{"id": i, "name": n, "category": c, "stock": s} for i, n, c, s in inv]
    out_of_stock = [p for p in inventory_all if p["stock"] <= 0]
    low = [p for p in inventory_all if 0 < p["stock"] <= LOW_STOCK]

    # ------------------------------------------------------------------ coupons
    coupon_rows = db.scalars(select(Coupon).order_by(desc(Coupon.used), Coupon.code)).all()
    coupons = [
        {"code": c.code, "type": c.type, "value": c.value, "used": c.used, "limit": c.limit, "active": c.active, "expires": c.expires,
         "usageRate": round(c.used / c.limit * 100, 1) if c.limit else None}
        for c in coupon_rows
    ]
    top_coupons = sorted(
        ({"code": k, "uses": v[0], "discount": v[1], "revenue": v[2]} for k, v in coupon_use.items()), key=lambda x: -x["uses"]
    )[:6]
    gross = revenue + discount_total

    return {
        "range": {"start": start.isoformat(), "end": end.isoformat(), "days": days},
        "revenue": {
            "total": revenue, "orders": orders, "daily": daily, "monthly": monthly, "yearly": yearly,
        },
        "sales": {
            "bestSelling": sorted(plist, key=lambda p: -p["units"])[:8],
            "topCategories": categories,
            "performance": sorted(plist, key=lambda p: -p["revenue"])[:20],
            "productRevenue": sorted(plist, key=lambda p: -p["revenue"])[:8],
        },
        "orders": {
            "statuses": statuses, "perDay": daily, "divisions": divisions, "districts": districts,
        },
        "customers": {
            "newCustomers": new_c, "returningCustomers": returning_c, "monthly": customer_monthly,
            "topSpenders": top_customers, "totalCustomers": len(first_seen),
        },
        "inventory": {
            "lowThreshold": LOW_STOCK, "outOfStockCount": len(out_of_stock), "lowStockCount": len(low),
            "total": len(inventory_all), "lowStock": (out_of_stock + low)[:20],
            "outOfStock": out_of_stock[:20], "levels": inventory_all[:20],
        },
        "coupons": {
            "list": coupons, "topCoupons": top_coupons,
            "ordersWithCoupon": coupon_orders, "orders": orders,
            "usageRate": round(coupon_orders / orders * 100, 1) if orders else 0,
            "discountGiven": discount_total, "revenue": revenue, "gross": gross,
            "discountPct": round(discount_total / gross * 100, 1) if gross else 0,
            "monthly": [{"month": _month_key(m), "discount": monthly_map[_month_key(m)][2] if _month_key(m) in monthly_map else 0,
                         "revenue": monthly_map[_month_key(m)][1] if _month_key(m) in monthly_map else 0} for m in months],
        },
    }
