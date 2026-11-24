import secrets
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.services.loyalty import award_order_points
from app.core.security import admin_user, current_user
from app.database.session import get_db
from app.models import EmailLog, Order, OrderItem, Product, StoreSetting, User, LoyaltyRewardCoupon, LoyaltyAccount
from app.schemas import CancelIn, OrderIn, PaymentIn, RefundIn, RefundRejectIn, RefundRequestIn, StatusIn
from app.services import orders as svc
from app.services.email import send_order_email, store_info
from app.services.invoice import build_invoice_pdf
from app.services.orders import FREE_DELIVERY_OVER, SHIPPING, counts_as_sale, evaluate_coupon, find_coupon, order_to_out

router = APIRouter(prefix="/api/orders", tags=["Orders"])
admin = APIRouter(prefix="/api/admin", tags=["Admin"], dependencies=[Depends(admin_user)])
settings_router = APIRouter(prefix="/api/settings", tags=["Settings"])


@router.post("", status_code=201)
def place_order(body: OrderIn, background: BackgroundTasks, user: User = Depends(current_user), db: Session = Depends(get_db)):
    # merge duplicate lines, then lock the product rows so concurrent orders can't oversell
    qty: dict[int, int] = defaultdict(int)
    for l in body.lines:
        qty[l.id] += l.quantity
    products = {p.id: p for p in db.scalars(select(Product).where(Product.id.in_(qty), Product.is_active).order_by(Product.id).with_for_update())}
    items, subtotal = [], 0
    for pid, q in qty.items():
        p = products.get(pid)
        if not p:
            raise HTTPException(400, "One of the products in your bag is no longer available.")
        if p.stock < q:
            raise HTTPException(409, f"{p.name} is out of stock. Please remove it from your bag." if p.stock <= 0
                                else f"Only {p.stock} of {p.name} left. Please reduce the quantity in your bag.")
        items.append(OrderItem(product_id=p.id, name=p.name, image=p.image, price=p.price, quantity=q))
        subtotal += p.price * q

    # Demo payment channels: no real gateway/merchant is connected. Mobile-wallet
    # submissions are stored for manual verification; SSLCommerz is simulated.
    payment_info = dict(body.payment_info or {})
    if body.payment in {"bkash_p2p", "nagad_p2p", "bkash", "nagad"}:
        payment_method = "bkash_p2p" if body.payment in {"bkash_p2p", "bkash"} else "nagad_p2p"
        trx = str(payment_info.get("trx_id") or payment_info.get("transaction_id") or "").strip()
        sender = str(payment_info.get("sender_number") or payment_info.get("number") or "").strip()
        if not trx or not sender:
            raise HTTPException(400, "Mobile-wallet sender number and transaction ID are required.")
        payment_info.update({"payment_method": payment_method, "trx_id": trx, "sender_number": sender, "payment_status": "pending_verification", "demo": True})
    elif body.payment in {"sslcommerz_demo", "sslcommerz"}:
        payment_method = "sslcommerz_demo"
        payment_info.update({"payment_method": payment_method, "trx_id": str(payment_info.get("trx_id") or "DEMO-SSL-" + secrets.token_hex(4).upper()), "payment_status": "pending_verification", "demo": True})
    reward_coupon = None
    discount, code = 0, None
    if body.coupon:
        c, discount, err = evaluate_coupon(find_coupon(db, body.coupon, lock=True), subtotal)
        if err:
            raise HTTPException(400, err)
        reward_coupon = db.scalar(select(LoyaltyRewardCoupon).where(LoyaltyRewardCoupon.code == c.code))
        if reward_coupon and (reward_coupon.user_id != user.id or reward_coupon.redeemed_order_id):
            raise HTTPException(400, "This loyalty coupon is already used or belongs to another account.")
        c.used += 1
        code = c.code

    fee, free_over = SHIPPING[body.shipping]
    delivery = 0 if (free_over and subtotal >= FREE_DELIVERY_OVER) else fee
    loyalty = db.scalar(select(LoyaltyAccount).where(LoyaltyAccount.user_id == user.id))
    if loyalty and (loyalty.lifetime_points >= 2500 or (loyalty.platinum_free_delivery_until and loyalty.platinum_free_delivery_until > datetime.utcnow())):
        delivery = 0

    for it in items:
        products[it.product_id].stock -= it.quantity

    order = Order(
        id="NX" + "".join(secrets.choice("0123456789") for _ in range(8)), user_id=user.id, email=user.email,
        shipping=body.shipping, payment=body.payment, payment_info=payment_info or None, subtotal=subtotal,
        delivery=delivery, discount=discount, coupon=code, total=subtotal - discount + delivery,
        name=body.address.name, phone=body.address.phone, address=body.address.address,
        area=body.address.area, district=body.address.district, items=items,
    )
    order.created_at = datetime.utcnow()
    order.payment_status = "pending_verification" if body.payment in {"bkash", "nagad", "bkash_p2p", "nagad_p2p", "sslcommerz", "sslcommerz_demo"} else "Unpaid"
    svc.mark_placed(order)
    db.add(order)
    if reward_coupon:
        reward_coupon.redeemed_order_id = order.id
    db.commit()
    db.refresh(order)
    background.add_task(send_order_email, order.id, "placed")
    background.add_task(send_order_email, order.id, "admin_new_order")
    return order_to_out(order)


def _own_order(db: Session, oid: str, user: User, lock: bool = False) -> Order:
    o = db.get(Order, oid, with_for_update=lock)
    # 404 (not 403) for other people's orders so order numbers can't be probed
    if not o or (o.user_id != user.id and not user.is_admin):
        raise HTTPException(404, "Order not found.")
    return o


@router.get("/mine")
def my_orders(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Order).where(Order.user_id == user.id).order_by(Order.created_at.desc()))
    return [order_to_out(o) for o in rows]


@router.get("/{oid}")
def order_detail(oid: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return order_to_out(_own_order(db, oid, user), admin=user.is_admin)


@router.get("/{oid}/invoice")
def order_invoice(oid: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """PDF invoice for the order's owner (or any admin)."""
    o = _own_order(db, oid, user)
    pdf = build_invoice_pdf(o, store_info(db))
    return Response(pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="invoice-{o.id}.pdf"', "Cache-Control": "no-store"})


@router.post("/{oid}/cancel")
def cancel_my_order(oid: str, body: CancelIn, background: BackgroundTasks, user: User = Depends(current_user), db: Session = Depends(get_db)):
    o = _own_order(db, oid, user, lock=True)
    if o.user_id != user.id:
        raise HTTPException(404, "Order not found.")
    kind = svc.customer_cancel(db, o, body.reason)
    db.commit()
    db.refresh(o)
    background.add_task(send_order_email, o.id, kind or "cancelled")
    background.add_task(send_order_email, o.id, "admin_cancelled")
    return order_to_out(o)


@router.post("/{oid}/refund-request")
def request_my_refund(oid: str, body: RefundRequestIn, background: BackgroundTasks, user: User = Depends(current_user), db: Session = Depends(get_db)):
    o = _own_order(db, oid, user, lock=True)
    if o.user_id != user.id:
        raise HTTPException(404, "Order not found.")
    svc.request_refund(o, body.reason)
    db.commit()
    db.refresh(o)
    background.add_task(send_order_email, o.id, "refund_requested")
    background.add_task(send_order_email, o.id, "admin_refund_request")
    return order_to_out(o)


# ---------------- admin
def _locked(db: Session, oid: str) -> Order:
    o = db.get(Order, oid, with_for_update=True)
    if not o:
        raise HTTPException(404, "Order not found.")
    return o


@admin.get("/orders")
def all_orders(db: Session = Depends(get_db)):
    return [order_to_out(o, admin=True) for o in db.scalars(select(Order).order_by(Order.created_at.desc()))]


@admin.patch("/orders/{oid}/status")
def set_status(
    oid: str,
    body: StatusIn,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    o = _locked(db, oid)

    kind = svc.change_status(
        db,
        o,
        body.status,
        "admin",
        note=body.note,
        courier=body.courier,
        tracking=body.tracking_number,
    )

    # Release an account-bound loyalty coupon if an order is cancelled; retain its
    # association when the order is reopened or otherwise active.
    if o.coupon:
        reward = db.scalar(select(LoyaltyRewardCoupon).where(LoyaltyRewardCoupon.code == o.coupon))
        if reward:
            reward.redeemed_order_id = None if body.status.lower() == "cancelled" else o.id

    # Award loyalty points on the actual store status "Delivered".
    # The service checks for an existing earned transaction by order ID, so
    # retrying this status update cannot double-credit the customer. Also run
    # when an already-delivered order is re-saved, allowing recovery of orders
    # that were delivered before this reward hook was fixed.
    if o.status == "Delivered" and o.user_id is not None:
        award_order_points(
            db=db,
            user_id=o.user_id,
            order_id=o.id,
            order_total=o.total,
        )

    db.commit()
    db.refresh(o)

    if kind:
        background.add_task(send_order_email, o.id, kind)

    return order_to_out(o, admin=True)


@admin.patch("/orders/{oid}/payment")
def set_payment(oid: str, body: PaymentIn, db: Session = Depends(get_db)):
    o = _locked(db, oid)
    svc.set_payment(o, body.paid, "admin")
    db.commit()
    db.refresh(o)
    return order_to_out(o, admin=True)


@admin.post("/orders/{oid}/refund")
def refund(oid: str, body: RefundIn, background: BackgroundTasks, db: Session = Depends(get_db)):
    o = _locked(db, oid)
    svc.issue_refund(db, o, body.amount, body.method, body.note, body.restock)
    db.commit()
    db.refresh(o)
    background.add_task(send_order_email, o.id, "refund_refunded")
    return order_to_out(o, admin=True)


@admin.post("/orders/{oid}/refund/reject")
def reject_refund(oid: str, body: RefundRejectIn, background: BackgroundTasks, db: Session = Depends(get_db)):
    o = _locked(db, oid)
    svc.reject_refund(o, body.note)
    db.commit()
    db.refresh(o)
    background.add_task(send_order_email, o.id, "refund_rejected")
    return order_to_out(o, admin=True)


@admin.post("/orders/{oid}/email-invoice", status_code=202)
def email_invoice(oid: str, background: BackgroundTasks, db: Session = Depends(get_db)):
    o = db.get(Order, oid)
    if not o:
        raise HTTPException(404, "Order not found.")
    if not o.email:
        raise HTTPException(400, "This order has no customer e-mail address.")
    background.add_task(send_order_email, o.id, "invoice")
    return {"queued": True, "to": o.email}


@admin.get("/orders/{oid}/emails")
def order_emails(oid: str, db: Session = Depends(get_db)):
    rows = db.scalars(select(EmailLog).where(EmailLog.order_id == oid).order_by(EmailLog.id.desc()).limit(50))
    return [{"id": r.id, "kind": r.kind, "to": r.to_email, "subject": r.subject, "status": r.status, "error": r.error,
             "at": r.created_at.isoformat() + "Z"} for r in rows]


@admin.get("/stats")
def stats(db: Session = Depends(get_db)):
    orders = db.scalars(select(Order)).all()
    live = [o for o in orders if counts_as_sale(o)]
    today = datetime.utcnow().date()
    week = []
    for i in range(29, -1, -1):
        d = today - timedelta(days=i)
        week.append({"day": d.strftime("%a"), "orders": sum(1 for o in live if o.created_at and o.created_at.date() == d),
                     "sales": sum(o.total for o in live if o.created_at and o.created_at.date() == d)})
    monthly: dict[str, int] = defaultdict(int)
    for o in live:
        if o.created_at:
            monthly[o.created_at.strftime("%Y-%m")] += o.total
    sold: dict[int, int] = defaultdict(int)
    for o in live:
        for it in o.items:
            if it.product_id:
                sold[it.product_id] += it.quantity
    return {
        "sales": sum(o.total for o in live), "orders": len(orders),
        "customers": len({o.phone for o in orders}), "daily": week,
        "monthly": [[k, monthly[k]] for k in sorted(monthly)][-12:],
        "sold": sold,
    }


# ---------------- store settings (public read, admin write)
DEFAULT_SETTINGS = {
    "storeName": "NEXORA", "tagline": "Considered products for modern living.", "logo": "", "email": "hello@nexora.com",
    "phone": "+880 1700 000000", "whatsapp": "+880 1700 000000", "address": "Road 11, Banani, Dhaka 1213, Bangladesh",
    "facebook": "facebook.com/nexora", "instagram": "instagram.com/nexora", "hours": "Sat – Thu, 10:00 AM – 8:00 PM",
}


@settings_router.get("")
def get_settings(db: Session = Depends(get_db)):
    row = db.get(StoreSetting, "store")
    return {**DEFAULT_SETTINGS, **(row.value if row else {})}


@settings_router.put("", dependencies=[Depends(admin_user)])
def put_settings(body: dict, db: Session = Depends(get_db)):
    clean = {k: str(body.get(k, ""))[:2_000_000] for k in DEFAULT_SETTINGS}
    row = db.get(StoreSetting, "store")
    if row:
        row.value = clean
    else:
        db.add(StoreSetting(key="store", value=clean))
    db.commit()
    return clean
