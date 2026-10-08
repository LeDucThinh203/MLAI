import json
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
    inputData: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    result: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    timestamp: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    def to_dict(self) -> dict:
        inp = {}
        if self.inputData:
            try:
                inp = json.loads(self.inputData)
            except Exception:
                inp = self.inputData
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "action": self.action,
            "actor": {
                "id": self.actorId,
                "name": self.actorName,
                "role": self.actorRole,
                "username": self.actorUsername
            },
            "caseId": self.caseId,
            "input": inp,
            "result": self.result or "SUCCESS",
            "reason": self.reason
        }
