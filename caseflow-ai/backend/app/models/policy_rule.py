import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Text, Unicode, UnicodeText, Boolean, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class PolicyRule(Base):
    __tablename__ = "PolicyRules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    policy_id: Mapped[str] = mapped_column(String(36), ForeignKey("Policies.id"), nullable=False, index=True)
    rule_code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    name: Mapped[str] = mapped_column(Unicode(200), nullable=False)
    description: Mapped[str] = mapped_column(UnicodeText, nullable=False)
    condition_type: Mapped[str] = mapped_column(String(50), nullable=False)  # MATCH, RANGE, ROLE_AUTHORITY, etc.
    condition_value: Mapped[str] = mapped_column(UnicodeText, nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)  # AUTO_RESOLVE, ESCALATE, REQUEST_INFORMATION, REJECT
    priority: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    policy = relationship("Policy", back_populates="rules")
