import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Text, Unicode, UnicodeText, Float, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class CaseDecision(Base):
    __tablename__ = "CaseDecisions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("Cases.id"), nullable=False, index=True)
    decision_type: Mapped[str] = mapped_column(String(50), nullable=False)  # AUTO_RESOLVE, REQUEST_INFORMATION, ESCALATE, REJECT, NO_DECISION
    reason: Mapped[str] = mapped_column(UnicodeText, nullable=False)
    policy_reference: Mapped[Optional[str]] = mapped_column(Unicode(200), nullable=True)
    evidence_summary: Mapped[Optional[str]] = mapped_column(UnicodeText, nullable=True)
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # Metadata only
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    case = relationship("Case", back_populates="decisions")
