
from datetime import datetime
from app.database.session import Base
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column


class RecentlyViewed(Base):
    __tablename__ = "recently_viewed"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "product_id",
            name="uq_recently_viewed_user_product"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False
    )

    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"),
        index=True,
        nullable=False
    )

    viewed_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        index=True
    )


class ProductViewEvent(Base):
    __tablename__ = "product_view_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    viewed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)


class LoyaltyAccount(Base):
    __tablename__ = "loyalty_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False
    )

    points_balance: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )

    lifetime_points: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )

    platinum_free_delivery_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class LoyaltyTransaction(Base):
    __tablename__ = "loyalty_transactions"

    __table_args__ = (
        CheckConstraint(
            "points != 0",
            name="ck_loyalty_nonzero_points"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False
    )

    # Order IDs are string identifiers (e.g. NX12345678), so do not use an integer FK.
    order_id: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)

    points: Mapped[int] = mapped_column(Integer, nullable=False)

    transaction_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )

    description: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        index=True
    )

class WishlistItem(Base):
    __tablename__ = "wishlist_items"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "product_id",
            name="uq_wishlist_user_product",
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
    )

class Review(Base):
    __tablename__ = "reviews"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "product_id",
            name="uq_review_user_product",
        ),
        CheckConstraint(
            "rating >= 1 AND rating <= 5",
            name="ck_review_rating",
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    rating: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    title: Mapped[str | None] = mapped_column(String(120), nullable=True)

    comment: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    approved: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
    )

class LoyaltyRewardCoupon(Base):
    __tablename__ = "loyalty_reward_coupons"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False, index=True)
    tier: Mapped[str] = mapped_column(String(40), nullable=False)
    coupon_id: Mapped[int] = mapped_column(ForeignKey("coupons.id", ondelete="CASCADE"), nullable=False)
    claimed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    redeemed_order_id: Mapped[str | None] = mapped_column(String(20), nullable=True)
