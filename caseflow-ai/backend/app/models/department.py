import uuid
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, Text, Unicode, UnicodeText
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class Department(Base):
    __tablename__ = "Departments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(Unicode(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(UnicodeText, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    cases = relationship("Case", back_populates="current_department")
    escalations = relationship("Escalation", back_populates="target_department")
