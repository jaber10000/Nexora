
from pydantic import BaseModel, Field


class LoyaltyBalanceOut(BaseModel):
    points_balance: int
    lifetime_points: int
    current_tier: str


class LoyaltyRedeemIn(BaseModel):
    points: int = Field(gt=0, le=100000)


class LoyaltyRedeemOut(BaseModel):
    success: bool
    points_used: int
    discount_amount: int
    remaining_points: int


class LoyaltyTransactionOut(BaseModel):
    id: int
    points: int
    transaction_type: str
    description: str | None = None
    created_at: str


class LoyaltyOfferOut(BaseModel):
    tier: str
    required_points: int
    reward: str
    unlocked: bool
