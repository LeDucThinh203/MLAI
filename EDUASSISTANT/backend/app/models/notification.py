from typing import Optional
from sqlalchemy import String, Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    userId: Mapped[str] = mapped_column(String(100), ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(String(50), default="INFO")
    caseId: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    isRead: Mapped[int] = mapped_column(Integer, default=0)
    createdAt: Mapped[str] = mapped_column(String(100), nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "userId": self.userId,
            "title": self.title,
            "message": self.message,
            "type": self.type,
            "caseId": self.caseId,
            "isRead": bool(self.isRead),
            "read": bool(self.isRead),
            "createdAt": self.createdAt,
        }
