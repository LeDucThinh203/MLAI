from typing import Optional, List, Any
from pydantic import BaseModel, Field


class CreateCaseRequest(BaseModel):
    title: Optional[str] = 'Yêu cầu cấp Giấy xác nhận sinh viên phục vụ tạm hoãn NVQS'
    category: Optional[str] = 'MILITARY_SERVICE_CONFIRMATION'
    description: Optional[str] = ''
    priority: Optional[str] = 'MEDIUM'
    evidenceFiles: Optional[List[Any]] = Field(default_factory=list)
    assignedDepartment: Optional[str] = 'Phòng Quản lý Đào tạo'
    deadline: Optional[str] = None
    # NVQS Domain fields:
    studentClaim: Optional[Any] = None
    addressType: Optional[str] = 'PERMANENT'  # PERMANENT | TEMPORARY
    rawAddress: Optional[str] = ''
    declaredStructuredAddress: Optional[Any] = None
    notes: Optional[str] = ''


class ReviewCaseRequest(BaseModel):
    action: Optional[str] = None
    decision: Optional[str] = None
    reason: Optional[str] = ''
    overrideReason: Optional[str] = None
    assignedDepartment: Optional[str] = None
    targetStatus: Optional[str] = None


class ReviewerFeedbackRequest(BaseModel):
    type: str
    note: Optional[str] = ''


class AddCommentRequest(BaseModel):
    content: str


class SupplementCaseRequest(BaseModel):
    additionalDescription: Optional[str] = ''
    newEvidenceFiles: Optional[List[Any]] = Field(default_factory=list)


class ReRouteCaseRequest(BaseModel):
    department: str
