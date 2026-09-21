from typing import List
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.evidence_service import EvidenceService
from app.schemas.evidence import EvidenceResponse
from app.schemas.evidence_extraction import EvidenceExtractionResponse

router = APIRouter(tags=["Evidence"])

@router.post("/cases/{id}/evidence", response_model=EvidenceResponse)
async def upload_case_evidence(
    id: str,
    file: UploadFile = File(...),
    evidence_type: str = Form("RECEIPT"),
    source_description: str = Form(None),
    db: Session = Depends(get_db)
):
    service = EvidenceService(db)
    file_bytes = await file.read()
    try:
        evidence = await service.upload_evidence(
            case_id=id,
            original_filename=file.filename or "uploaded_file",
            content_type=file.content_type or "application/octet-stream",
            file_bytes=file_bytes,
            evidence_type=evidence_type,
            source_description=source_description
        )
        return evidence
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/cases/{id}/evidence", response_model=List[EvidenceResponse])
def list_case_evidence(id: str, db: Session = Depends(get_db)):
    service = EvidenceService(db)
    return service.list_by_case(id)

@router.get("/evidence/{id}", response_model=EvidenceResponse)
def get_evidence(id: str, db: Session = Depends(get_db)):
    service = EvidenceService(db)
    evidence = service.get_by_id(id)
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return evidence

@router.post("/evidence/{id}/analyze", response_model=EvidenceExtractionResponse)
async def analyze_evidence(id: str, db: Session = Depends(get_db)):
    service = EvidenceService(db)
    try:
        extraction = await service.analyze_evidence(id)
        return extraction
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
