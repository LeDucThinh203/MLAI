from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class CaseDecisionBase(BaseModel):
    decision_type: str  # AUTO_RESOLVE, REQUEST_INFORMATION, ESCALATE, REJECT, NO_DECISION
    reason: str
    policy_reference: Optional[str] = None
    evidence_summary: Optional[str] = None
    confidence: Optional[float] = None

class CaseDecisionCreate(CaseDecisionBase):
    case_id: str

class CaseDecisionResponse(CaseDecisionBase):
    id: str
    case_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
