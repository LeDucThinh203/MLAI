from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.escalation import EscalationResponse
from app.schemas.human_review import HumanReviewResponse, HumanReviewActionRequest
from app.services.human_review_service import HumanReviewService
from app.services.escalation_service import EscalationService

router = APIRouter(prefix="/human-review", tags=["Human Review"])

@router.get("", response_model=List[EscalationResponse])
def list_pending_escalations(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    service = HumanReviewService(db)
    items = service.list_pending_reviews(skip, limit)
    return [EscalationResponse.model_validate(item) for item in items]

@router.get("/{id}", response_model=EscalationResponse)
def get_escalation(id: str, db: Session = Depends(get_db)):
    esc_service = EscalationService(db)
    item = esc_service.get_by_id(id)
    if not item:
        raise HTTPException(status_code=404, detail="Escalation not found")
    return EscalationResponse.model_validate(item)

@router.post("/{id}/approve", response_model=HumanReviewResponse)
def approve_escalation(id: str, payload: HumanReviewActionRequest, db: Session = Depends(get_db)):
    esc_service = EscalationService(db)
    esc = esc_service.get_by_id(id)
    if not esc:
        raise HTTPException(status_code=404, detail="Escalation not found")
    review_service = HumanReviewService(db)
    return review_service.process_action(esc.case_id, "APPROVE", payload)

@router.post("/{id}/reject", response_model=HumanReviewResponse)
def reject_escalation(id: str, payload: HumanReviewActionRequest, db: Session = Depends(get_db)):
    esc_service = EscalationService(db)
    esc = esc_service.get_by_id(id)
    if not esc:
        raise HTTPException(status_code=404, detail="Escalation not found")
    review_service = HumanReviewService(db)
    return review_service.process_action(esc.case_id, "REJECT", payload)

@router.post("/{id}/override", response_model=HumanReviewResponse)
def override_escalation(id: str, payload: HumanReviewActionRequest, db: Session = Depends(get_db)):
    esc_service = EscalationService(db)
    esc = esc_service.get_by_id(id)
    if not esc:
        raise HTTPException(status_code=404, detail="Escalation not found")
    review_service = HumanReviewService(db)
    return review_service.process_action(esc.case_id, "OVERRIDE", payload)

@router.post("/{id}/request-information", response_model=HumanReviewResponse)
def request_info_escalation(id: str, payload: HumanReviewActionRequest, db: Session = Depends(get_db)):
    esc_service = EscalationService(db)
    esc = esc_service.get_by_id(id)
    if not esc:
        raise HTTPException(status_code=404, detail="Escalation not found")
    review_service = HumanReviewService(db)
    return review_service.process_action(esc.case_id, "REQUEST_INFORMATION", payload)
