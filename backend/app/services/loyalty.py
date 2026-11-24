from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import LoyaltyAccount, LoyaltyTransaction


# Rules
POINTS_PER_100 = 10  # ৳100 = 10 points
DISCOUNT_PER_100_POINTS = 100  # 100 points = ৳100


LOYALTY_TIERS = [
    {
        "tier": "Bronze",
        "required_points": 500,
        "benefits": ["15% One-Time Coupon"],
    },
    {
        "tier": "Silver",
        "required_points": 1000,
        "benefits": ["30% One-Time Coupon"],
    },
    {
        "tier": "Platinum",
        "required_points": 1500,
        "benefits": ["Free Delivery for 30 Days"],
    },
    {
        "tier": "Diamond",
        "required_points": 2000,
        "benefits": [
            "50% One-Time Coupon",
            "Priority Support",
        ],
    },
    {
        "tier": "Gold Elite",
        "required_points": 2500,
        "benefits": [
            "Free Delivery",
            "Exclusive Offers",
            "VIP Coupons",
        ],
    },
]


def get_or_create_account(db: Session, user_id: int):
    account = db.scalar(
        select(LoyaltyAccount).where(
            LoyaltyAccount.user_id == user_id
        )
    )

    if not account:
        account = LoyaltyAccount(
            user_id=user_id,
            points_balance=0,
            lifetime_points=0,
        )
        db.add(account)
        db.flush()

    return account


def award_order_points(
    db: Session,
    user_id: int,
    order_id: str,
    order_total: float,
):
    # Prevent duplicate rewards
    existing = db.scalar(
        select(LoyaltyTransaction).where(
            LoyaltyTransaction.user_id == user_id,
            LoyaltyTransaction.order_id == order_id,
            LoyaltyTransaction.transaction_type == "earned",
        )
    )

    if existing:
        return existing.points

    # ৳100 = 10 points
    points = int(order_total // 100) * POINTS_PER_100

    if points <= 0:
        return 0

    account = get_or_create_account(db, user_id)

    account.points_balance += points
    previous_lifetime = account.lifetime_points
    account.lifetime_points += points
    if previous_lifetime < 1500 <= account.lifetime_points and not account.platinum_free_delivery_until:
        account.platinum_free_delivery_until = datetime.utcnow() + timedelta(days=30)

    transaction = LoyaltyTransaction(
        user_id=user_id,
        order_id=order_id,
        points=points,
        transaction_type="earned",
        description=f"Points earned from order #{order_id}",
    )

    db.add(transaction)
    db.flush()

    return points


def redeem_points(
    db: Session,
    user_id: int,
    points: int,
):
    if points <= 0:
        raise ValueError("Points must be greater than zero.")

    account = get_or_create_account(db, user_id)

    if account.points_balance < points:
        raise ValueError("Insufficient loyalty points.")

    # 100 points = ৳100 discount
    discount = int((points / 100) * DISCOUNT_PER_100_POINTS)

    if discount <= 0:
        raise ValueError("Invalid redeem amount.")

    account.points_balance -= points

    transaction = LoyaltyTransaction(
        user_id=user_id,
        points=-points,
        transaction_type="redeemed",
        description=f"Redeemed {points} points for ৳{discount} discount",
    )

    db.add(transaction)
    db.flush()

    return {
        "points_used": points,
        "discount_amount": discount,
        "remaining_points": account.points_balance,
    }


def get_current_tier(db: Session, user_id: int):
    account = get_or_create_account(db, user_id)

    current = "Member"

    for tier in LOYALTY_TIERS:
        if account.lifetime_points >= tier["required_points"]:
            current = tier["tier"]

    return current


def get_loyalty_offers(db: Session, user_id: int):
    account = get_or_create_account(db, user_id)

    result = []

    for tier in LOYALTY_TIERS:
        result.append(
            {
                **tier,
                "unlocked": (
                    account.lifetime_points
                    >= tier["required_points"]
                ),
                "remaining_points": max(
                    0,
                    tier["required_points"]
                    - account.lifetime_points,
                ),
            }
        )

    return result