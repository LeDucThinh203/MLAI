from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class HumanReviewBase(BaseModel):
    reviewer_name: str
    reviewer_role: str
    decision: str  # APPROVE, REJECT, OVERRIDE, REQUEST_INFORMATION, STOP, RESUME
    reason: str

class HumanReviewCreate(HumanReviewBase):
    case_id: str

class HumanReviewActionRequest(BaseModel):
    reviewer_name: str = "Admin Reviewer"
    reviewer_role: str = "Academic Affairs Officer"
    reason: str

class HumanReviewResponse(HumanReviewBase):
    id: str
    case_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
