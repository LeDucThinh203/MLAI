import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Integer, Boolean, Text, Unicode, DateTime, ForeignKey
from sqlalchemy.dialects.mssql import NVARCHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class VerificationResult(Base):
    __tablename__ = "VerificationResults"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("VerificationRuns.id"), nullable=False, index=True)
    case_identifier: Mapped[str] = mapped_column(String(100), nullable=False)
    case_title: Mapped[str] = mapped_column(Unicode(255), nullable=False)
    expected_decision: Mapped[str] = mapped_column(String(50), nullable=False)
    actual_decision: Mapped[str] = mapped_column(String(50), nullable=False)
    expected_escalation: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    actual_escalation: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_passed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    details_json: Mapped[Optional[str]] = mapped_column(Text().with_variant(NVARCHAR(None), "mssql"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    run = relationship("VerificationRun", back_populates="results")
