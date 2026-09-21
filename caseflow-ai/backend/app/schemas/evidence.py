from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from app.schemas.evidence_extraction import EvidenceExtractionResponse

class EvidenceBase(BaseModel):
    evidence_type: str
    original_file_name: str
    source_description: Optional[str] = None

class EvidenceCreate(EvidenceBase):
    case_id: str
    stored_file_name: str
    mime_type: str
    file_size: int
    sha256_hash: str
    storage_path: str

class EvidenceResponse(BaseModel):
    id: str
    case_id: str
    evidence_type: str
    original_file_name: str
    stored_file_name: str
    mime_type: str
    file_size: int
    sha256_hash: str
    storage_path: str
    source_description: Optional[str] = None
    uploaded_at: datetime
    analysis_status: str
    extractions: List[EvidenceExtractionResponse] = []

    model_config = ConfigDict(from_attributes=True)
