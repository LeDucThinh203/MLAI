import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Text, Unicode, UnicodeText, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class Policy(Base):
    __tablename__ = "Policies"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(Unicode(200), nullable=False)
    description: Mapped[str] = mapped_column(UnicodeText, nullable=False)
    version: Mapped[str] = mapped_column(String(20), default="1.0", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    rules = relationship("PolicyRule", back_populates="policy", cascade="all, delete-orphan")
