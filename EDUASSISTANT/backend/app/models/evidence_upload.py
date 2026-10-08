from typing import Optional
from sqlalchemy import String, Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class EvidenceUpload(Base):
    __tablename__ = "evidence_uploads"

    fileName: Mapped[str] = mapped_column(String(255), primary_key=True)
    ownerId: Mapped[str] = mapped_column(String(100), ForeignKey("users.id"), nullable=False, index=True)
    metadata_json: Mapped[str] = mapped_column("metadata", Text, nullable=False)
    ocrData: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ocrProvider: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    ocrIsLive: Mapped[int] = mapped_column(Integer, default=0)
    createdAt: Mapped[str] = mapped_column(String(100), nullable=False)

    def to_dict(self) -> dict:
        return {
            "fileName": self.fileName,
            "ownerId": self.ownerId,
            "metadata": self.metadata_json,
            "ocrData": self.ocrData,
            "ocrProvider": self.ocrProvider,
            "ocrIsLive": bool(self.ocrIsLive),
            "createdAt": self.createdAt,
        }
