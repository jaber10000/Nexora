
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import current_user, admin_user
from app.database.session import get_db
from app.models import (
    User,
    LoyaltyAccount,
    LoyaltyTransaction,
)
from app.schemas.loyalty import LoyaltyRedeemIn
from app.services.loyalty import (
    get_or_create_account,
    get_current_tier,
    get_loyalty_offers,
    redeem_points,
)

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
    db.commit()

    return {
        "lifetime_points": account.lifetime_points,
        "current_tier": get_current_tier(db, user.id),
        "offers": get_loyalty_offers(db, user.id),
    }


@router.post("/redeem")
def redeem_loyalty_points(
    body: LoyaltyRedeemIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    try:
        result = redeem_points(db, user.id, body.points)
        db.commit()

        return {
            "success": True,
            **result,
        }

    except ValueError as exc:
        db.rollback()
        raise HTTPException(400, str(exc))


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
