
from datetime import date, timedelta
import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import current_user, admin_user
from app.database.session import get_db
from app.models import (
    User,
    LoyaltyAccount,
    LoyaltyTransaction,
    Coupon,
    LoyaltyRewardCoupon,
)
from app.schemas.loyalty import LoyaltyRedeemIn
from app.services.loyalty import (
    get_or_create_account,
    get_current_tier,
    get_loyalty_offers,
    redeem_points,
    LOYALTY_TIERS,
)



def _ensure_tier_coupons(db: Session, user_id: int, lifetime_points: int):
    """Issue one-time tier percentage coupons for unlocked tiers; never duplicates."""
    coupon_tiers = {"Bronze": 15, "Silver": 30, "Diamond": 50, "Gold Elite": 10}
    issued = []
    for tier, percent in coupon_tiers.items():
        threshold = next(t["required_points"] for t in LOYALTY_TIERS if t["tier"] == tier)
        if lifetime_points < threshold:
            continue
        existing = db.scalar(select(LoyaltyRewardCoupon).where(
            LoyaltyRewardCoupon.user_id == user_id, LoyaltyRewardCoupon.tier == tier
        ))
        if existing:
            continue
        code = f"NX{tier.upper().replace(' ', '')[:4]}{secrets.token_hex(3).upper()}"
        coupon = Coupon(code=code, type="percent", value=percent, min_order=0, limit=1, used=0,
                       expires=(date.today() + timedelta(days=365)).isoformat(), active=True)
        db.add(coupon); db.flush()
        reward = LoyaltyRewardCoupon(user_id=user_id, code=code, tier=tier, coupon_id=coupon.id)
        db.add(reward); issued.append({"tier": tier, "code": code, "discount_percent": percent})
    db.flush()
    return issued

router = APIRouter(
    prefix="/api/loyalty",
    tags=["Customer Loyalty"],
)


@router.get("/balance")
def loyalty_balance(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    account = get_or_create_account(db, user.id)
    db.commit()

    return {
        "points_balance": account.points_balance,
        "lifetime_points": account.lifetime_points,
        "current_tier": get_current_tier(db, user.id),
        "free_delivery_until": account.platinum_free_delivery_until.isoformat() if account.platinum_free_delivery_until else None,
    }


@router.get("/history")
def loyalty_history(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    transactions = db.scalars(
        select(LoyaltyTransaction)
        .where(LoyaltyTransaction.user_id == user.id)
        .order_by(
            LoyaltyTransaction.created_at.desc(),
            LoyaltyTransaction.id.desc()
        )
        .limit(100)
    ).all()

    return {
        "items": [
            {
                "id": t.id,
                "points": t.points,
                "transaction_type": t.transaction_type,
                "description": t.description,
                "created_at": (
                    t.created_at.isoformat()
                    if t.created_at else None
                ),
            }
            for t in transactions
        ]
    }


@router.get("/offers")
def loyalty_offers(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    account = get_or_create_account(db, user.id)
    _ensure_tier_coupons(db, user.id, account.lifetime_points)
    rewards = db.scalars(select(LoyaltyRewardCoupon).where(LoyaltyRewardCoupon.user_id == user.id).order_by(LoyaltyRewardCoupon.id)).all()
    db.commit()

    return {
        "lifetime_points": account.lifetime_points,
        "current_tier": get_current_tier(db, user.id),
        "offers": get_loyalty_offers(db, user.id),
        "coupons": [{"code": r.code, "tier": r.tier, "redeemed": bool(r.redeemed_order_id)} for r in rewards],
    }


@router.post("/redeem")
def redeem_loyalty_points(
    body: LoyaltyRedeemIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    try:
        result = redeem_points(db, user.id, body.points)
        code = f"NXP{secrets.token_hex(4).upper()}"
        coupon = Coupon(code=code, type="fixed", value=result["discount_amount"], min_order=0, limit=1, used=0,
                        expires=(date.today() + timedelta(days=30)).isoformat(), active=True)
        db.add(coupon); db.flush()
        db.add(LoyaltyRewardCoupon(user_id=user.id, code=code, tier="Points Redemption", coupon_id=coupon.id))
        db.commit()

        return {
            "success": True,
            "coupon_code": code,
            "expires": coupon.expires,
            **result,
        }

    except ValueError as exc:
        db.rollback()
        raise HTTPException(400, str(exc))


@router.get("/coupons")
def loyalty_coupons(user: User = Depends(current_user), db: Session = Depends(get_db)):
    account = get_or_create_account(db, user.id)
    _ensure_tier_coupons(db, user.id, account.lifetime_points)
    rewards = db.scalars(select(LoyaltyRewardCoupon).where(LoyaltyRewardCoupon.user_id == user.id).order_by(LoyaltyRewardCoupon.id.desc())).all()
    db.commit()
    return {"items": [{"code": r.code, "tier": r.tier, "redeemed": bool(r.redeemed_order_id), "expires": db.get(Coupon, r.coupon_id).expires if db.get(Coupon, r.coupon_id) else None, "coupon_type": db.get(Coupon, r.coupon_id).type if db.get(Coupon, r.coupon_id) else None, "coupon_value": db.get(Coupon, r.coupon_id).value if db.get(Coupon, r.coupon_id) else None} for r in rewards]}


# Admin: customer loyalty overview
@router.get("/admin/accounts")
def admin_loyalty_accounts(
    admin: User = Depends(admin_user),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        select(LoyaltyAccount, User)
        .join(User, User.id == LoyaltyAccount.user_id)
        .order_by(LoyaltyAccount.points_balance.desc())
        .limit(100)
    ).all()

    return {
        "items": [
            {
                "user_id": user.id,
                "name": user.name,
                "email": user.email,
                "points_balance": account.points_balance,
                "lifetime_points": account.lifetime_points,
            }
            for account, user in rows
        ]
    }
