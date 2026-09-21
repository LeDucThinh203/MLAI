from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, ConfigDict

class VerificationResultResponse(BaseModel):
    id: str
    run_id: str
    case_identifier: str
    case_title: str
    expected_decision: str
    actual_decision: str
    expected_escalation: Optional[str] = None
    actual_escalation: Optional[str] = None
    is_passed: bool
    duration_ms: int
    details_json: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class VerificationRunResponse(BaseModel):
    id: str
    run_code: str
    status: str
    total_cases: int
    passed_cases: int
    failed_cases: int
    duration_ms: int
    created_at: datetime
    completed_at: Optional[datetime] = None
    results: List[VerificationResultResponse] = []

    model_config = ConfigDict(from_attributes=True)

class VerificationRunSummary(BaseModel):
    run_id: str
    run_code: str
    status: str
    total: int
    passed: int
    failed: int
    pass_rate: float
    duration_ms: int
