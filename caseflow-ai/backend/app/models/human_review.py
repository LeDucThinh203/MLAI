import uuid
from datetime import datetime, timezone
from sqlalchemy import Unicode, UnicodeText, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class HumanReview(Base):
    __tablename__ = "HumanReviews"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("Cases.id"), nullable=False, index=True)
    reviewer_name: Mapped[str] = mapped_column(Unicode(100), nullable=False)
    reviewer_role: Mapped[str] = mapped_column(Unicode(100), nullable=False)
    decision: Mapped[str] = mapped_column(String(50), nullable=False)  # APPROVE, REJECT, OVERRIDE, REQUEST_INFORMATION, STOP, RESUME
    reason: Mapped[str] = mapped_column(UnicodeText, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    case = relationship("Case", back_populates="human_reviews")
