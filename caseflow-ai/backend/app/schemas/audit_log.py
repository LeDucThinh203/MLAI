from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class AuditLogBase(BaseModel):
    case_id: str
    actor_type: str  # STUDENT, SYSTEM, AI_VLM, STAFF, ADMIN
    actor_name: str
    action: str
    input_snapshot: Optional[str] = None
    evidence_ids: Optional[str] = None
    reason: Optional[str] = None
    policy_reference: Optional[str] = None
    result_snapshot: Optional[str] = None

class AuditLogCreate(AuditLogBase):
    pass

class AuditLogResponse(AuditLogBase):
    id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
