import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Text, Unicode, UnicodeText, DateTime, ForeignKey, Index, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class Case(Base):
    __tablename__ = "Cases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(Unicode(255), nullable=False)
    description: Mapped[str] = mapped_column(UnicodeText, nullable=False)
    student_identifier: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    case_type: Mapped[str] = mapped_column(String(100), nullable=False)
    sis_amount: Mapped[Optional[float]] = mapped_column(Numeric(18, 2), nullable=True)
    sis_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="NEW", index=True)
    current_department_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("Departments.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    current_department = relationship("Department", back_populates="cases")
    messages = relationship("CaseMessage", back_populates="case", cascade="all, delete-orphan")
    evidence_items = relationship("Evidence", back_populates="case", cascade="all, delete-orphan")
    comparisons = relationship("EvidenceComparison", back_populates="case", cascade="all, delete-orphan")
    decisions = relationship("CaseDecision", back_populates="case", cascade="all, delete-orphan")
    escalations = relationship("Escalation", back_populates="case", cascade="all, delete-orphan")
    human_reviews = relationship("HumanReview", back_populates="case", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="case", cascade="all, delete-orphan")
