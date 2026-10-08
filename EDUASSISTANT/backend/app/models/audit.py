from typing import Optional
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class Audit(Base):
    __tablename__ = "audits"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    caseId: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    actorId: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    actorName: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    actorRole: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    actorUsername: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    timestamp: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "action": self.action,
            "caseId": self.caseId,
            "actorId": self.actorId,
            "actorName": self.actorName,
            "actorRole": self.actorRole,
            "actorUsername": self.actorUsername,
            "reason": self.reason,
            "timestamp": self.timestamp,
        }
