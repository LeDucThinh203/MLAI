from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.human_review import HumanReview
from app.models.escalation import Escalation

class HumanReviewRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_review(self, review: HumanReview) -> HumanReview:
        self.db.add(review)
        self.db.commit()
        self.db.refresh(review)
        return review

    def list_by_case(self, case_id: str) -> List[HumanReview]:
        return self.db.query(HumanReview).filter(HumanReview.case_id == case_id).order_by(HumanReview.created_at.desc()).all()

    def list_pending_escalations(self, skip: int = 0, limit: int = 50) -> List[Escalation]:
        return self.db.query(Escalation).filter(Escalation.status == "PENDING").order_by(Escalation.created_at.desc()).offset(skip).limit(limit).all()

    def get_escalation_by_id(self, escalation_id: str) -> Optional[Escalation]:
        return self.db.query(Escalation).filter(Escalation.id == escalation_id).first()

    def get_escalation_by_case_id(self, case_id: str) -> Optional[Escalation]:
        return self.db.query(Escalation).filter(Escalation.case_id == case_id, Escalation.status == "PENDING").first()

    def update_escalation(self, escalation: Escalation) -> Escalation:
        self.db.commit()
        self.db.refresh(escalation)
        return escalation
