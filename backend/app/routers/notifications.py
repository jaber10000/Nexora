"""Notification Center (admin only).

Notifications are generated from the live data (orders, payments, stock, customers) each time the
list is read (throttled), de-duplicated by a unique `ref`. No hooks into other routers are needed.
"""
import time
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.security import admin_user
from app.database.session import get_db
from app.models import Notification, Order, Product, User

router = APIRouter(prefix="/api/admin/notifications", tags=["Notifications"], dependencies=[Depends(admin_user)])

LOW_STOCK = 8
KINDS = ("order", "stock", "payment", "customer")
_last_sync = 0.0


def _candidates(db: Session) -> list[dict]:
    out: list[dict] = []
    now = datetime.utcnow()

    for o in db.scalars(select(Order).order_by(Order.created_at.desc()).limit(25)):
        n = sum(i.quantity for i in o.items)
        when = o.created_at or now
        out.append(dict(ref=f"order:{o.id}", kind="order", severity="info", title=f"New order #{o.id}",
                        body=f"{o.name} · ৳{o.total:,} · {n} item{'s' if n != 1 else ''}", link="/admin/orders", at=when))
        method = str((o.payment_info or {}).get("payment_method") or o.payment).replace("_", " ")
        if o.payment_status == "pending_verification":
            out.append(dict(ref=f"pay:{o.id}:verify", kind="payment", severity="warning", title=f"Payment to verify · #{o.id}",
                            body=f"{method} · ৳{o.total:,} · TrxID {(o.payment_info or {}).get('trx_id', '—')}", link="/admin/orders", at=when))
        elif o.payment_status == "Paid":
            out.append(dict(ref=f"pay:{o.id}:paid", kind="payment", severity="success", title=f"Payment received · #{o.id}",
                            body=f"৳{o.total:,} paid via {method}", link="/admin/orders", at=when))
        if o.refund_status == "Requested":
            out.append(dict(ref=f"refund:{o.id}", kind="payment", severity="danger", title=f"Refund requested · #{o.id}",
                            body=f"{o.name} asked for ৳{(o.refund_amount or o.total):,} back", link="/admin/orders", at=o.refund_requested_at or when))
        if o.cancelled_by == "customer":
            out.append(dict(ref=f"cancel:{o.id}", kind="customer", severity="warning", title=f"Order cancelled by customer · #{o.id}",
                            body=o.cancel_reason or o.name, link="/admin/orders", at=o.cancelled_at or when))

    for u in db.scalars(select(User).where(User.is_admin.is_(False)).order_by(User.created_at.desc()).limit(10)):
        out.append(dict(ref=f"cust:{u.id}", kind="customer", severity="success", title="New customer joined",
                        body=f"{u.name} · {u.email}", link="/admin/customers", at=u.created_at or now))

    for p in db.scalars(select(Product).where(Product.is_active, Product.stock <= LOW_STOCK).order_by(Product.stock).limit(40)):
        out_of = p.stock <= 0
        out.append(dict(ref=f"stock:{p.id}:{'out' if out_of else 'low'}", kind="stock", severity="danger" if out_of else "warning",
                        title="Out of stock" if out_of else "Low stock",
                        body=f"{p.name} — {'none left' if out_of else f'only {p.stock} left'}", link="/admin/inventory", at=now))
    return out


def _sync(db: Session, force: bool = False) -> None:
    global _last_sync
    if not force and time.monotonic() - _last_sync < 8:
        return
    _last_sync = time.monotonic()
    cands = _candidates(db)
    existing = set(db.scalars(select(Notification.ref).where(Notification.ref.in_([c["ref"] for c in cands]))))
    fresh_cut = datetime.utcnow() - timedelta(hours=24)
    for c in cands:
        if c["ref"] in existing:
            continue
        # history older than a day is added silently as already-read, so first run doesn't flood the bell
        db.add(Notification(ref=c["ref"], kind=c["kind"], severity=c["severity"], title=c["title"], body=c["body"][:300],
                            link=c["link"], created_at=c["at"], is_read=c["at"] < fresh_cut))
    # stock alerts for products that have since been restocked are dropped so they can fire again later
    live_stock = {c["ref"] for c in cands if c["kind"] == "stock"}
    for n in db.scalars(select(Notification).where(Notification.kind == "stock")):
        if n.ref not in live_stock:
            db.delete(n)
    db.commit()


def _out(n: Notification) -> dict:
    return {"id": n.id, "kind": n.kind, "severity": n.severity, "title": n.title, "body": n.body, "link": n.link,
            "read": n.is_read, "createdAt": n.created_at.isoformat() + "Z" if n.created_at else None}


def _unread(db: Session) -> dict:
    rows = dict(db.execute(select(Notification.kind, func.count()).where(Notification.is_read.is_(False)).group_by(Notification.kind)).all())
    return {"total": sum(rows.values()), **{k: int(rows.get(k, 0)) for k in KINDS}}


@router.get("")
def list_notifications(kind: str | None = None, unread: bool = False, limit: int = 60, db: Session = Depends(get_db)):
    _sync(db)
    q = select(Notification).order_by(Notification.created_at.desc(), Notification.id.desc()).limit(max(1, min(limit, 200)))
    if kind in KINDS:
        q = q.where(Notification.kind == kind)
    if unread:
        q = q.where(Notification.is_read.is_(False))
    return {"items": [_out(n) for n in db.scalars(q)], "unread": _unread(db)}


@router.post("/read")
def mark_read(body: dict, db: Session = Depends(get_db)):
    """body: {"ids": [1,2]} | {"kind": "order"} | {"all": true}"""
    q = Notification.__table__.update().where(Notification.is_read.is_(False)).values(is_read=True)
    if isinstance(body.get("ids"), list):
        q = q.where(Notification.id.in_([int(i) for i in body["ids"]]))
    elif body.get("kind") in KINDS:
        q = q.where(Notification.kind == body["kind"])
    elif not body.get("all"):
        raise HTTPException(422, "Nothing to mark as read.")
    db.execute(q)
    db.commit()
    return {"unread": _unread(db)}


@router.delete("/{nid}")
def dismiss(nid: int, db: Session = Depends(get_db)):
    n = db.get(Notification, nid)
    if n and n.kind != "stock":
        db.delete(n)
        db.commit()
    elif n:  # stock alerts clear themselves on restock; dismissing just marks them read
        n.is_read = True
        db.commit()
    return {"unread": _unread(db)}


@router.delete("")
def clear_read(db: Session = Depends(get_db)):
    """Remove every already-read notification (stock alerts that are still true are kept)."""
    db.execute(delete(Notification).where(Notification.is_read.is_(True), Notification.kind != "stock"))
    db.commit()
    return {"unread": _unread(db)}
