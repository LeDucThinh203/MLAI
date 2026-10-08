from typing import Optional, List, Any
from pydantic import BaseModel


class CreateCaseRequest(BaseModel):
    title: str
    category: str
    description: Optional[str] = ''
    priority: Optional[str] = 'MEDIUM'
    evidenceFiles: Optional[List[Any]] = []
    assignedDepartment: Optional[str] = None
    deadline: Optional[str] = None


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
    newEvidenceFiles: Optional[List[Any]] = []


class ReRouteCaseRequest(BaseModel):
    department: str
