import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class Evidence(Base):
    __tablename__ = "Evidence"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("Cases.id"), nullable=False, index=True)
    evidence_type: Mapped[str] = mapped_column(String(50), nullable=False)  # RECEIPT, SCREENSHOT, PDF_CONFIRMATION, etc.
    original_file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    source_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    analysis_status: Mapped[str] = mapped_column(String(50), default="PENDING", nullable=False)  # PENDING, ANALYZED, FAILED

    case = relationship("Case", back_populates="evidence_items")
    extractions = relationship("EvidenceExtraction", back_populates="evidence", cascade="all, delete-orphan")
