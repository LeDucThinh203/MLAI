from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, model_validator
from app.schemas.department import DepartmentResponse
from app.schemas.evidence import EvidenceResponse
from app.schemas.evidence_comparison import EvidenceComparisonResponse
from app.schemas.decision import CaseDecisionResponse
from app.schemas.escalation import EscalationResponse
from app.schemas.human_review import HumanReviewResponse
from app.schemas.case_message import CaseMessageResponse
from app.schemas.audit_log import AuditLogResponse

class CaseBase(BaseModel):
    title: str
    description: str
    student_identifier: str
    case_type: str
    sis_amount: Optional[float] = None
    sis_status: Optional[str] = None
    current_department_id: Optional[str] = None

class CaseCreate(CaseBase):
    @model_validator(mode="after")
    def require_sis_data_for_tuition(self):
        if self.case_type == "TUITION_STATUS":
            if self.sis_amount is None or self.sis_amount < 0:
                raise ValueError("Hồ sơ học phí cần số tiền đối chiếu từ SIS hợp lệ.")
            if not self.sis_status or not self.sis_status.strip():
                raise ValueError("Hồ sơ học phí cần trạng thái đối chiếu từ SIS.")
        return self

class CaseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    current_department_id: Optional[str] = None
    sis_amount: Optional[float] = None
    sis_status: Optional[str] = None

class CaseResponse(CaseBase):
    id: str
    case_code: str
    status: str
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    current_department: Optional[DepartmentResponse] = None

    model_config = ConfigDict(from_attributes=True)

class CaseDetailResponse(CaseResponse):
    messages: List[CaseMessageResponse] = []
    evidence_items: List[EvidenceResponse] = []
    comparisons: List[EvidenceComparisonResponse] = []
    decisions: List[CaseDecisionResponse] = []
    escalations: List[EscalationResponse] = []
    human_reviews: List[HumanReviewResponse] = []
    audit_logs: List[AuditLogResponse] = []

    model_config = ConfigDict(from_attributes=True)

class CaseTimelineEvent(BaseModel):
    timestamp: datetime
    actor_type: str
    actor_name: str
    action: str
    description: str
    status_change: Optional[str] = None
    details: Optional[dict] = None
