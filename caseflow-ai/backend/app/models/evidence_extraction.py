import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Unicode, UnicodeText, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.mssql import NVARCHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class EvidenceExtraction(Base):
    __tablename__ = "EvidenceExtractions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    evidence_id: Mapped[str] = mapped_column(String(36), ForeignKey("Evidence.id"), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)  # GEMINI_VLM, etc.
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    document_type: Mapped[str] = mapped_column(Unicode(100), nullable=False)
    structured_data_json: Mapped[str] = mapped_column(Text().with_variant(NVARCHAR(None), "mssql"), nullable=False)
    extraction_summary: Mapped[Optional[str]] = mapped_column(UnicodeText, nullable=True)
    has_uncertain_fields: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    uncertain_fields_json: Mapped[Optional[str]] = mapped_column(Text().with_variant(NVARCHAR(None), "mssql"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    evidence = relationship("Evidence", back_populates="extractions")
