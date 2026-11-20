from datetime import date, datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Coupon, Order, OrderEvent, Product

FREE_DELIVERY_OVER = 5000
SHIPPING = {"standard": (120, True), "express": (250, False)}  # fee, free-over-threshold?

CUSTOMER_CANCEL_STATUSES = {"Pending", "Confirmed"}  # after "Processing" the parcel is being packed
STATUS_TITLES = {
    "Pending": "Moved back to pending",
    "Confirmed": "Order confirmed",
    "Processing": "Packed and being prepared",
    "Shipped": "Shipped",
    "Delivered": "Delivered",
    "Cancelled": "Order cancelled",
}


def is_sale():
    """SQL filter for orders that count as revenue: not cancelled and not fully refunded."""
    return and_(
        Order.status != "Cancelled",
        or_(Order.refund_status.is_(None), Order.refund_status != "Refunded", Order.refund_amount < Order.total),
    )


def counts_as_sale(o: Order) -> bool:
    return o.status != "Cancelled" and not (o.refund_status == "Refunded" and o.refund_amount >= o.total)


# ---------------------------------------------------------------- coupons
def evaluate_coupon(c: Coupon | None, subtotal: int) -> tuple[Coupon | None, int, str | None]:
    """Returns (coupon, discount, error)."""
    if not c or not c.active:
        return None, 0, "This coupon code is not valid."
    if date.fromisoformat(c.expires) < date.today():
        return None, 0, "This coupon has expired."
    if c.used >= c.limit:
        return None, 0, "This coupon has reached its usage limit."
    if subtotal < c.min_order:
        return None, 0, f"Minimum order for this coupon is ৳{c.min_order:,}."
    raw = round(subtotal * c.value / 100) if c.type == "percent" else c.value
    return c, min(raw, subtotal), None


def find_coupon(db: Session, code: str, lock: bool = False) -> Coupon | None:
    q = select(Coupon).where(Coupon.code == code.strip().upper())
    if lock:
        q = q.with_for_update()
    return db.scalars(q).first()


# ---------------------------------------------------------------- stock
def restock(db: Session, o: Order, sign: int) -> None:
    """sign=+1 puts the items back on the shelf, -1 takes them out."""
    for it in o.items:
        if it.product_id is None:
            continue
        p = db.get(Product, it.product_id, with_for_update=True)
        if p:
            p.stock = max(0, p.stock + sign * it.quantity)


def _check_stock_for_reopen(db: Session, o: Order) -> None:
    for it in o.items:
        if it.product_id is None:
            continue
        p = db.get(Product, it.product_id, with_for_update=True)
        if p and p.stock < it.quantity:
            raise HTTPException(409, f"Cannot reopen: only {p.stock} of {p.name} in stock (order needs {it.quantity}).")


def _adjust_coupon(db: Session, o: Order, delta: int) -> None:
    if o.coupon:
        c = find_coupon(db, o.coupon, lock=True)
        if c:
            c.used = max(0, c.used + delta)


# ---------------------------------------------------------------- timeline
def add_event(o: Order, kind: str, title: str, note: str | None = None, status: str | None = None, actor: str = "system",
              at: datetime | None = None) -> OrderEvent:
    ev = OrderEvent(kind=kind, title=title, note=(note or None), status=status, actor=actor, created_at=at or datetime.utcnow())
    o.events.append(ev)
    return ev


def _iso(d: datetime | None) -> str | None:
    return d.isoformat() + "Z" if d else None  # DB stores naive UTC


def delivered_at(o: Order) -> datetime:
    for ev in reversed(o.events):
        if ev.status == "Delivered" and ev.kind == "status":
            return ev.created_at
    return o.created_at or datetime.utcnow()


# ---------------------------------------------------------------- rules shown to the UI
def can_cancel(o: Order) -> bool:
    return o.status in CUSTOMER_CANCEL_STATUSES


def refund_block_reason(o: Order) -> str | None:
    """None when the customer may request a refund, otherwise the reason they can't."""
    if o.refund_status == "Refunded":
        return "This order has already been refunded."
    if o.refund_status == "Requested":
        return "A refund is already being processed for this order."
    if o.refund_status == "Rejected":
        return "Your refund request was reviewed. Please contact support for more help."
    if o.status != "Delivered":
        return "Refunds can be requested once the order has been delivered."
    if o.payment_status != "Paid":
        return "No payment is recorded for this order."
    if datetime.utcnow() - delivered_at(o) > timedelta(days=settings.refund_window_days):
        return f"The {settings.refund_window_days}-day refund window has passed."
    return None


def order_to_out(o: Order, admin: bool = False) -> dict:
    out = {
        "id": o.id,
        "invoiceNo": "INV-" + o.id,
        "createdAt": _iso(o.created_at or datetime.utcnow()),
        "status": o.status,
        "lines": [{"id": i.product_id, "name": i.name, "image": i.image, "price": i.price, "quantity": i.quantity} for i in o.items],
        "subtotal": o.subtotal, "delivery": o.delivery, "discount": o.discount, "coupon": o.coupon, "total": o.total,
        "shipping": o.shipping, "payment": o.payment, "email": o.email,
        "address": {"name": o.name, "phone": o.phone, "address": o.address, "area": o.area, "district": o.district},
        "paymentStatus": o.payment_status or "Unpaid",
        "courier": o.courier, "trackingNumber": o.tracking_number,
        "cancelReason": o.cancel_reason, "cancelledBy": o.cancelled_by, "cancelledAt": _iso(o.cancelled_at),
        "refund": None if not o.refund_status else {
            "status": o.refund_status, "reason": o.refund_reason, "amount": o.refund_amount, "method": o.refund_method,
            "note": o.refund_note, "requestedAt": _iso(o.refund_requested_at), "refundedAt": _iso(o.refunded_at),
        },
        "timeline": [{"id": e.id, "kind": e.kind, "title": e.title, "note": e.note, "status": e.status, "actor": e.actor,
                      "at": _iso(e.created_at)} for e in o.events],
        "canCancel": can_cancel(o),
        "refundBlockReason": refund_block_reason(o),
        "canRequestRefund": refund_block_reason(o) is None,
    }
    if admin:
        out["userId"] = o.user_id
    return out


# ---------------------------------------------------------------- state changes (callers commit)
def mark_placed(o: Order) -> None:
    add_event(o, "placed", "Order placed", "We received your order and will confirm it shortly.", status="Pending", at=o.created_at)


def change_status(db: Session, o: Order, new: str, actor: str, note: str | None = None, courier: str | None = None,
                  tracking: str | None = None) -> str | None:
    """Moves an order to a new status, with side effects. Returns the e-mail kind to send (or None)."""
    note = (note or "").strip() or None
    old = o.status
    if courier is not None:
        o.courier = courier.strip() or None
    if tracking is not None:
        o.tracking_number = tracking.strip() or None

    if new == old:
        if new == "Shipped" and (courier is not None or tracking is not None):
            add_event(o, "note", "Tracking details updated", _tracking_note(o), actor=actor)
        return None
    if o.refund_status == "Refunded" and old != "Cancelled":
        raise HTTPException(409, "This order has been refunded, its status can no longer be changed.")

    if new == "Cancelled":
        if old == "Delivered":
            raise HTTPException(409, "A delivered order can't be cancelled. Issue a refund instead.")
        restock(db, o, +1)
        _adjust_coupon(db, o, -1)
        o.cancel_reason = note
        o.cancelled_by = actor
        o.cancelled_at = datetime.utcnow()
        add_event(o, "cancel", f"Order cancelled by {'you' if actor == 'customer' else 'the store'}", note, status="Cancelled", actor=actor)
        if o.payment_status == "Paid" and not o.refund_status:
            o.refund_status = "Requested"
            o.refund_reason = "Order cancelled"
            o.refund_requested_at = datetime.utcnow()
            add_event(o, "refund", "Refund due", "Your payment will be refunded after the store processes it.", actor="system")
        o.status = new
        return "cancelled"

    if old == "Cancelled":  # reopening
        if o.refund_status == "Refunded":
            raise HTTPException(409, "This order was refunded and can't be reopened. Ask the customer to place a new order.")
        _check_stock_for_reopen(db, o)
        restock(db, o, -1)
        _adjust_coupon(db, o, +1)
        o.cancel_reason = o.cancelled_by = o.cancelled_at = None
        if o.refund_status == "Requested" and o.refund_reason == "Order cancelled":
            o.refund_status = o.refund_reason = o.refund_requested_at = None
        add_event(o, "status", "Order reopened", note, actor=actor)

    o.status = new
    if new == "Delivered" and o.payment_status != "Paid":
        o.payment_status = "Paid"
        add_event(o, "payment", "Payment received", "Cash collected on delivery." if o.payment == "cod" else None, actor=actor)
    title = STATUS_TITLES[new]
    detail = note
    if new == "Shipped":
        detail = " · ".join(x for x in (_tracking_note(o), note) if x) or None
    add_event(o, "status", title, detail, status=new, actor=actor)
    return {"Confirmed": "confirmed", "Processing": "processing", "Shipped": "shipped", "Delivered": "delivered"}.get(new)


def _tracking_note(o: Order) -> str | None:
    bits = [x for x in (o.courier, f"Tracking no. {o.tracking_number}" if o.tracking_number else None) if x]
    return " · ".join(bits) or None


def customer_cancel(db: Session, o: Order, reason: str) -> str | None:
    if not can_cancel(o):
        raise HTTPException(409, "This order is already being prepared and can no longer be cancelled online. Please contact support.")
    return change_status(db, o, "Cancelled", "customer", note=reason)


def request_refund(o: Order, reason: str) -> None:
    blocked = refund_block_reason(o)
    if blocked:
        raise HTTPException(409, blocked)
    o.refund_status = "Requested"
    o.refund_reason = reason.strip()
    o.refund_requested_at = datetime.utcnow()
    add_event(o, "refund", "Refund requested", reason.strip(), actor="customer")


def set_payment(o: Order, paid: bool, actor: str) -> None:
    if o.refund_status == "Refunded":
        raise HTTPException(409, "This order has been refunded.")
    if o.status == "Cancelled":
        raise HTTPException(409, "A cancelled order can't be marked as paid.")
    new = "Paid" if paid else "Unpaid"
    if (o.payment_status or "Unpaid") == new:
        return
    if not paid and o.refund_status == "Requested":
        raise HTTPException(409, "Resolve the pending refund request first.")
    o.payment_status = new
    add_event(o, "payment", "Payment received" if paid else "Payment marked as unpaid", actor=actor)


def issue_refund(db: Session, o: Order, amount: int, method: str, note: str | None, restock_items: bool) -> None:
    if o.refund_status == "Refunded":
        raise HTTPException(409, "This order has already been refunded.")
    if (o.payment_status or "Unpaid") != "Paid":
        raise HTTPException(409, "No payment is recorded for this order, so there is nothing to refund. Mark it as paid first if the customer did pay.")
    if amount > o.total:
        raise HTTPException(400, f"The refund can't be more than the order total (৳{o.total:,}).")
    full = amount >= o.total
    if restock_items and o.status != "Cancelled":
        restock(db, o, +1)
    o.refund_status = "Refunded"
    o.refund_amount = amount
    o.refund_method = method.strip()
    o.refund_note = (note or "").strip() or None
    o.refunded_at = datetime.utcnow()
    o.payment_status = "Refunded" if full else "Partially Refunded"
    detail = f"৳{amount:,} refunded via {o.refund_method}" + (f" · {o.refund_note}" if o.refund_note else "")
    if restock_items and o.status != "Cancelled":
        detail += " · items returned to stock"
    add_event(o, "refund", "Refund completed" if full else "Partial refund completed", detail, actor="admin")


def reject_refund(o: Order, note: str) -> None:
    if o.refund_status != "Requested":
        raise HTTPException(409, "There is no pending refund request on this order.")
    if o.status == "Cancelled":
        raise HTTPException(409, "A cancelled, paid order must be refunded - the customer already paid for goods they won't receive.")
    o.refund_status = "Rejected"
    o.refund_note = note.strip()
    add_event(o, "refund", "Refund request declined", note.strip(), actor="admin")
