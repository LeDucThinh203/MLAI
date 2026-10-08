from typing import Optional
from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    caseId: Mapped[str] = mapped_column(String(100), ForeignKey("cases.id"), nullable=False, index=True)
    authorId: Mapped[str] = mapped_column(String(100), ForeignKey("users.id"), nullable=False)
    authorName: Mapped[str] = mapped_column(String(255), nullable=False)
    authorRole: Mapped[str] = mapped_column(String(50), nullable=False)
    authorAvatar: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    createdAt: Mapped[str] = mapped_column(String(100), nullable=False)

    # Relationships
    case: Mapped["Case"] = relationship("Case", back_populates="comments")
    author: Mapped["User"] = relationship("User", back_populates="comments")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "caseId": self.caseId,
            "authorId": self.authorId,
            "authorName": self.authorName,
            "authorRole": self.authorRole,
            "authorAvatar": self.authorAvatar,
            "content": self.content,
            "createdAt": self.createdAt,
        }
