from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class Category(Base):
    __tablename__ = "categories"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")


class Coupon(Base):
    __tablename__ = "coupons"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    type: Mapped[str] = mapped_column(String(10), nullable=False)  # percent | fixed
    value: Mapped[int] = mapped_column(Integer, nullable=False)
    min_order: Mapped[int] = mapped_column(Integer, default=0)
    limit: Mapped[int] = mapped_column(Integer, default=0)
    used: Mapped[int] = mapped_column(Integer, default=0)
    expires: Mapped[str] = mapped_column(String(10), nullable=False)  # YYYY-MM-DD
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class StoreSetting(Base):
    """Single-row key/value store; 'store' holds the admin Settings object."""
    __tablename__ = "store_settings"
    key: Mapped[str] = mapped_column(String(40), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON, nullable=False)


class Order(Base):
    __tablename__ = "orders"
    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True, nullable=True)
    email: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)
    status: Mapped[str] = mapped_column(String(20), default="Pending", index=True)
    shipping: Mapped[str] = mapped_column(String(20), nullable=False)
    payment: Mapped[str] = mapped_column(String(20), nullable=False)
    payment_info: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    subtotal: Mapped[int] = mapped_column(Integer, nullable=False)
    delivery: Mapped[int] = mapped_column(Integer, nullable=False)
    discount: Mapped[int] = mapped_column(Integer, default=0)
    coupon: Mapped[str | None] = mapped_column(String(40), nullable=True)
    total: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    address: Mapped[str] = mapped_column(String(300), nullable=False)
    area: Mapped[str] = mapped_column(String(100), nullable=False)
    district: Mapped[str] = mapped_column(String(60), nullable=False)
    # --- payment / fulfilment
    payment_status: Mapped[str] = mapped_column(String(20), default="Unpaid")  # Unpaid | Paid | Refunded
    courier: Mapped[str | None] = mapped_column(String(60), nullable=True)
    tracking_number: Mapped[str | None] = mapped_column(String(80), nullable=True)
    # --- cancellation
    cancel_reason: Mapped[str | None] = mapped_column(String(300), nullable=True)
    cancelled_by: Mapped[str | None] = mapped_column(String(10), nullable=True)  # customer | admin
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # --- refund:  None | Requested | Refunded | Rejected
    refund_status: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    refund_reason: Mapped[str | None] = mapped_column(String(300), nullable=True)
    refund_amount: Mapped[int] = mapped_column(Integer, default=0)
    refund_method: Mapped[str | None] = mapped_column(String(40), nullable=True)
    refund_note: Mapped[str | None] = mapped_column(String(300), nullable=True)
    refund_requested_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    items: Mapped[list["OrderItem"]] = relationship(cascade="all, delete-orphan", lazy="selectin")
    events: Mapped[list["OrderEvent"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="OrderEvent.id"
    )


class OrderItem(Base):
    __tablename__ = "order_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    image: Mapped[str] = mapped_column(Text, default="")
    price: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)


class OrderEvent(Base):
    """One entry of the order tracking timeline (shown to the customer and the admin)."""
    __tablename__ = "order_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(30), nullable=False)  # placed | status | payment | cancel | refund | note
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    note: Mapped[str | None] = mapped_column(String(400), nullable=True)
    status: Mapped[str | None] = mapped_column(String(20), nullable=True)  # order status after this event
    actor: Mapped[str] = mapped_column(String(10), default="system")  # system | customer | admin
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class EmailLog(Base):
    """Every notification e-mail the shop tried to send (so admins can see what customers received)."""
    __tablename__ = "email_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[str | None] = mapped_column(String(20), index=True, nullable=True)
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    to_email: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(10), nullable=False)  # sent | logged | failed
    error: Mapped[str | None] = mapped_column(String(400), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
