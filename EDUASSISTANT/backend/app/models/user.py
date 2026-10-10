from __future__ import annotations
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.case import Case
    from app.models.comment import Comment

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    fullName: Mapped[str] = mapped_column(String(255), nullable=False)
    studentCode: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(50), nullable=False)  # STUDENT, REVIEWER, ADMIN
    department: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    avatar: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    twoFactorEnabled: Mapped[int] = mapped_column(Integer, default=0)
    twoFactorSecret: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    mustChangePassword: Mapped[int] = mapped_column(Integer, default=0)
    # Authoritative Institutional Record fields:
    academicStatus: Mapped[Optional[str]] = mapped_column(String(50), default="ACTIVE")
    courseStartDate: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    courseEndDate: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    currentTermActive: Mapped[Optional[int]] = mapped_column(Integer, default=1)
    hasCurrentSchedule: Mapped[Optional[int]] = mapped_column(Integer, default=1)
    registeredPermanentAddress: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    faculty: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    createdAt: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    updatedAt: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Relationships
    cases: Mapped[List["Case"]] = relationship("Case", back_populates="student", cascade="all, delete-orphan")
    comments: Mapped[List["Comment"]] = relationship("Comment", back_populates="author")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "username": self.username,
            "password": self.password,
            "fullName": self.fullName,
            "studentCode": self.studentCode,
            "email": self.email,
            "role": self.role,
            "department": self.department,
            "avatar": self.avatar,
            "bio": self.bio,
            "twoFactorEnabled": bool(self.twoFactorEnabled),
            "twoFactorSecret": self.twoFactorSecret,
            "mustChangePassword": bool(self.mustChangePassword),
            "academicStatus": self.academicStatus or "ACTIVE",
            "courseStartDate": self.courseStartDate,
            "courseEndDate": self.courseEndDate,
            "currentTermActive": bool(self.currentTermActive),
            "hasCurrentSchedule": bool(self.hasCurrentSchedule),
            "registeredPermanentAddress": self.registeredPermanentAddress,
            "faculty": self.faculty,
            "createdAt": self.createdAt,
            "updatedAt": self.updatedAt,
        }
