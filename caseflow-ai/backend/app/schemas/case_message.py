from datetime import datetime
from pydantic import BaseModel, ConfigDict

class CaseMessageBase(BaseModel):
    sender_type: str
    sender_name: str
    message: str

class CaseMessageCreate(CaseMessageBase):
    case_id: str

class CaseMessageResponse(CaseMessageBase):
    id: str
    case_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
