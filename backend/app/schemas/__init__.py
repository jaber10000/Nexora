from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field
from pydantic.alias_generators import to_camel


class Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


# ---- auth
class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str
    phone: str | None = None
    is_admin: bool = False
    created_at: datetime | None = None


class ProfileIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str | None = Field(default=None, pattern=r"^(01[0-9]{9})?$")  # empty or 11-digit BD mobile


class PasswordIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=72)
    new_password: str = Field(min_length=8, max_length=72)


class TokenOut(BaseModel):
    access_token: str
    user: UserOut


# ---- catalog
class ProductIn(Camel):
    name: str = Field(min_length=1, max_length=180)
    category: str = Field(max_length=80)
    price: int = Field(gt=0)
    old_price: int | None = Field(default=None, gt=0)
    tag: str | None = Field(default=None, max_length=40)
    image: str = Field(min_length=1, max_length=2_000_000)
    description: str | None = None
    features: list[str] | None = None
    images: list[str] | None = Field(default=None, max_length=10)  # gallery, first one is the cover
    stock: int = Field(default=0, ge=0, le=9999)


class ProductOut(ProductIn):
    id: int


class StockIn(BaseModel):
    stock: int = Field(ge=0, le=9999)


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str = ""


class CategoryOut(CategoryIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class CouponIn(Camel):
    code: str = Field(min_length=2, max_length=40)
    type: Literal["percent", "fixed"]
    value: int = Field(gt=0)
    min_order: int = Field(default=0, ge=0)
    limit: int = Field(default=0, ge=0)
    expires: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    active: bool = True


class CouponOut(CouponIn):
    id: int
    used: int


class CouponCheckIn(BaseModel):
    code: str
    subtotal: int = Field(ge=0)


# ---- orders
class AddressIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(pattern=r"^01[0-9]{9}$")
    address: str = Field(min_length=1, max_length=300)
    area: str = Field(min_length=1, max_length=100)
    district: str = Field(min_length=1, max_length=60)


class LineIn(BaseModel):
    id: int
    quantity: int = Field(ge=1, le=99)


class OrderIn(BaseModel):
    lines: list[LineIn] = Field(min_length=1)
    shipping: Literal["standard", "express"]
    payment: Literal["cod", "bkash", "nagad", "sslcommerz", "bkash_p2p", "nagad_p2p", "sslcommerz_demo"]
    coupon: str | None = None
    address: AddressIn
    payment_info: dict | None = None


class OrderLineOut(BaseModel):
    id: int | None
    name: str
    image: str
    price: int
    quantity: int


class OrderOut(BaseModel):
    id: str
    createdAt: str
    status: str
    lines: list[OrderLineOut]
    subtotal: int
    delivery: int
    discount: int
    coupon: str | None
    total: int
    shipping: str
    payment: str
    email: str
    address: AddressIn


class StatusIn(Camel):
    status: Literal["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"]
    note: str | None = Field(default=None, max_length=300)  # shown in the timeline (cancel reason for Cancelled)
    courier: str | None = Field(default=None, max_length=60)
    tracking_number: str | None = Field(default=None, max_length=80)


class CancelIn(BaseModel):
    reason: str = Field(min_length=3, max_length=300)


class RefundRequestIn(BaseModel):
    reason: str = Field(min_length=3, max_length=300)


class RefundIn(Camel):
    amount: int = Field(gt=0)
    method: str = Field(min_length=1, max_length=40)  # e.g. bKash, Nagad, Bank transfer, Cash
    note: str | None = Field(default=None, max_length=300)
    restock: bool = False  # returned goods go back on the shelf (ignored for cancelled orders - already restocked)


class RefundRejectIn(BaseModel):
    note: str = Field(min_length=3, max_length=300)


class PaymentIn(BaseModel):
    paid: bool


# ---- customer engagement
class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    title: str | None = Field(default=None, max_length=120)
    comment: str = Field(min_length=3, max_length=2000)


class WishlistMergeIn(BaseModel):
    ids: list[int] = Field(default_factory=list, max_length=200)
