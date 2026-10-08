from typing import Optional
from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    userId: Mapped[str] = mapped_column(String(100), ForeignKey("users.id"), nullable=False, index=True)
    token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    expiresAt: Mapped[str] = mapped_column(String(100), nullable=False)
    createdAt: Mapped[str] = mapped_column(String(100), nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "userId": self.userId,
            "token": self.token,
            "expiresAt": self.expiresAt,
            "createdAt": self.createdAt,
        }
