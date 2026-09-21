from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class EvidenceComparisonBase(BaseModel):
    field_name: str
    left_value: Optional[str] = None
    right_value: Optional[str] = None
    comparison_status: str  # MATCH, MISMATCH, UNKNOWN, NOT_COMPARABLE
    reason: Optional[str] = None

class EvidenceComparisonCreate(EvidenceComparisonBase):
    case_id: str
    left_evidence_id: Optional[str] = None
    right_evidence_id: Optional[str] = None

class EvidenceComparisonResponse(EvidenceComparisonBase):
    id: str
    case_id: str
    left_evidence_id: Optional[str] = None
    right_evidence_id: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
