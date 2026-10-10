"""
============================================================================
EDUASSISTANT - ESCALATION POLICY STATE & HISTORY ORM MODELS
============================================================================
Lưu trữ ngưỡng thích ứng (Adaptive Threshold) bền vững trên PostgreSQL.
============================================================================
"""

from sqlalchemy import Column, String, Float, Text
from app.models.base import Base


class EscalationPolicyState(Base):
    __tablename__ = "escalation_policy_state"

    id = Column(String(100), primary_key=True)
    currentThreshold = Column(Float, nullable=False, default=0.75)
    minThreshold = Column(Float, nullable=False, default=0.65)
    maxThreshold = Column(Float, nullable=False, default=0.90)
    stepSize = Column(Float, nullable=False, default=0.02)
    updatedAt = Column(String(100), nullable=False)
    updatedBy = Column(String(100), nullable=True)


class EscalationThresholdHistory(Base):
    __tablename__ = "escalation_threshold_history"

    id = Column(String(100), primary_key=True)
    caseId = Column(String(100), nullable=True)
    feedbackType = Column(String(50), nullable=False)
    oldThreshold = Column(Float, nullable=False)
    newThreshold = Column(Float, nullable=False)
    reviewerId = Column(String(100), nullable=True)
    reviewerName = Column(String(255), nullable=True)
    note = Column(Text, nullable=True)
    createdAt = Column(String(100), nullable=False)
