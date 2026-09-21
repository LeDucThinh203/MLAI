from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field, ConfigDict

class EvidenceExtractionResult(BaseModel):
    """Structured extraction output from VLM or Document Analyzer."""
    document_type: Optional[str] = Field(default=None, description="Type of document (e.g. RECEIPT, SIS_SCREENSHOT, EMAIL, CONFIRMATION_LETTER)")
    student_identifier: Optional[str] = Field(default=None, description="Student ID or Code found in evidence")
    transaction_id: Optional[str] = Field(default=None, description="Bank transaction ID or reference")
    amount: Optional[float] = Field(default=None, description="Numeric transaction amount")
    currency: Optional[str] = Field(default="VND", description="Currency (e.g. VND, USD)")
    payment_date: Optional[str] = Field(default=None, description="Payment date as written on evidence")
    payment_status: Optional[str] = Field(default=None, description="Status found in evidence (PAID, UNPAID, PENDING, SUCCESS)")
    institution: Optional[str] = Field(default=None, description="Bank or institutional name")
    reference_number: Optional[str] = Field(default=None, description="Reference code / receipt number")
    system_status: Optional[str] = Field(default=None, description="Status in screenshot SIS / portal")
    deadline: Optional[str] = Field(default=None, description="Applicable deadline if mentioned")
    course_code: Optional[str] = Field(default=None, description="Course or class code if applicable")
    evidence_text: Optional[str] = Field(default=None, description="Verbatim extracted relevant text")
    uncertain_fields: List[str] = Field(default_factory=list, description="List of field names that were unreadable, ambiguous, or obscured")
    visual_quality: str = Field(default="CLEAR", description="Visual quality assessment: CLEAR, BLURRY, PARTIALLY_OBSCURED, UNREADABLE")
    notes: Optional[str] = Field(default=None, description="Additional context or extraction observations")

class EvidenceExtractionResponse(BaseModel):
    id: str
    evidence_id: str
    provider: str
    model_name: str
    document_type: str
    structured_data_json: str
    extraction_summary: Optional[str] = None
    has_uncertain_fields: bool
    uncertain_fields_json: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
