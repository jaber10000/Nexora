from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class Notification(Base):
    """Admin notification. `ref` is a unique key so the same event is never announced twice."""
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ref: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    kind: Mapped[str] = mapped_column(String(12), index=True, nullable=False)  # order | stock | payment | customer
    severity: Mapped[str] = mapped_column(String(10), default="info")  # info | success | warning | danger
    title: Mapped[str] = mapped_column(String(140), nullable=False)
    body: Mapped[str] = mapped_column(String(300), default="")
    link: Mapped[str] = mapped_column(String(120), default="")
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)
