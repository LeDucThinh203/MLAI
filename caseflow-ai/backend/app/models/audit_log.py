import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Text, Unicode, UnicodeText, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class AuditLog(Base):
    __tablename__ = "AuditLogs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("Cases.id"), nullable=False, index=True)
    actor_type: Mapped[str] = mapped_column(String(50), nullable=False)  # WHO: STUDENT, SYSTEM, AI_VLM, STAFF, ADMIN
    actor_name: Mapped[str] = mapped_column(Unicode(100), nullable=False)  # WHO
    action: Mapped[str] = mapped_column(Unicode(100), nullable=False)  # WHAT
    input_snapshot: Mapped[Optional[str]] = mapped_column(UnicodeText, nullable=True)  # INPUT
    evidence_ids: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # EVIDENCE
    reason: Mapped[Optional[str]] = mapped_column(UnicodeText, nullable=True)  # WHY
    policy_reference: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)  # POLICY
    result_snapshot: Mapped[Optional[str]] = mapped_column(UnicodeText, nullable=True)  # RESULT
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)  # WHEN

    case = relationship("Case", back_populates="audit_logs")
