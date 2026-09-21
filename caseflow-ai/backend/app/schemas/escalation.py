from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.department import DepartmentResponse

class EscalationBase(BaseModel):
    escalation_type: str  # FACT_UNKNOWN, POLICY_OUT_OF_SCOPE, AUTHORITY_REQUIRED, DATA_CONFLICT, OWNERSHIP_UNCLEAR
    target_role: str
    question: str
    reason: str
    evidence_summary: Optional[str] = None
    target_department_id: Optional[str] = None

class EscalationCreate(EscalationBase):
    case_id: str

class EscalationResponse(EscalationBase):
    id: str
    case_id: str
    status: str
    created_at: datetime
    resolved_at: Optional[datetime] = None
    target_department: Optional[DepartmentResponse] = None

    model_config = ConfigDict(from_attributes=True)
