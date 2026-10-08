from __future__ import annotations
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.comment import Comment

class Case(Base):
    __tablename__ = "cases"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    studentId: Mapped[str] = mapped_column(String(100), ForeignKey("users.id"), nullable=False, index=True)
    studentName: Mapped[str] = mapped_column(String(255), nullable=False)
    studentCode: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    priority: Mapped[str] = mapped_column(String(50), default="MEDIUM")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    reviewResult: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    supplementHistory: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    aiExtraction: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evidenceFiles: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    deadline: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    assignedDepartment: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    digitalSignature: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    createdAt: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    updatedAt: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Relationships
    student: Mapped["User"] = relationship("User", back_populates="cases")
    comments: Mapped[List["Comment"]] = relationship("Comment", back_populates="case", cascade="all, delete-orphan")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "studentId": self.studentId,
            "studentName": self.studentName,
            "studentCode": self.studentCode,
            "title": self.title,
            "category": self.category,
            "priority": self.priority,
            "description": self.description,
            "status": self.status,
            "reviewResult": self.reviewResult,
            "supplementHistory": self.supplementHistory,
            "aiExtraction": self.aiExtraction,
            "evidenceFiles": self.evidenceFiles,
            "deadline": self.deadline,
            "assignedDepartment": self.assignedDepartment,
            "digitalSignature": self.digitalSignature,
            "createdAt": self.createdAt,
            "updatedAt": self.updatedAt,
        }
