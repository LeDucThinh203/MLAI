import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Text, UnicodeText, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class EvidenceComparison(Base):
    __tablename__ = "EvidenceComparisons"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("Cases.id"), nullable=False, index=True)
    left_evidence_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    right_evidence_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    field_name: Mapped[str] = mapped_column(String(100), nullable=False)
    left_value: Mapped[Optional[str]] = mapped_column(UnicodeText, nullable=True)
    right_value: Mapped[Optional[str]] = mapped_column(UnicodeText, nullable=True)
    comparison_status: Mapped[str] = mapped_column(String(50), nullable=False)  # MATCH, MISMATCH, UNKNOWN, NOT_COMPARABLE
    reason: Mapped[Optional[str]] = mapped_column(UnicodeText, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    case = relationship("Case", back_populates="comparisons")
