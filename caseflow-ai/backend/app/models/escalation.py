import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Text, Unicode, UnicodeText, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class Escalation(Base):
    __tablename__ = "Escalations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("Cases.id"), nullable=False, index=True)
    escalation_type: Mapped[str] = mapped_column(String(50), nullable=False)  # FACT_UNKNOWN, POLICY_OUT_OF_SCOPE, AUTHORITY_REQUIRED, DATA_CONFLICT, OWNERSHIP_UNCLEAR
    target_department_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("Departments.id"), nullable=True)
    target_role: Mapped[str] = mapped_column(Unicode(100), nullable=False)
    question: Mapped[str] = mapped_column(UnicodeText, nullable=False)
    reason: Mapped[str] = mapped_column(UnicodeText, nullable=False)
    evidence_summary: Mapped[Optional[str]] = mapped_column(UnicodeText, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="PENDING", nullable=False)  # PENDING, RESOLVED, DISMISSED
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    case = relationship("Case", back_populates="escalations")
    target_department = relationship("Department", back_populates="escalations")

    @property
    def reason_code(self) -> str:
        return self.escalation_type

    @property
    def uncertainty_group(self) -> Optional[str]:
        from app.core.workflow import uncertainty_group
        return uncertainty_group(self.escalation_type)
