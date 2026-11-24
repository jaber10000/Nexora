from sqlalchemy import JSON, Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class Product(Base):
    __tablename__ = "products"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(80), nullable=False, index=True, default="")
    price: Mapped[int] = mapped_column(Integer, nullable=False)
    old_price: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tag: Mapped[str | None] = mapped_column(String(40), nullable=True)
    image: Mapped[str] = mapped_column(Text, nullable=False, default="")  # URL or data: URI
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    features: Mapped[list | None] = mapped_column(JSON, nullable=True)
    images: Mapped[list | None] = mapped_column(JSON, nullable=True)  # gallery: ordered list of URLs / data: URIs (first = cover)
    stock: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
