from typing import Optional
from sqlalchemy.orm import Session
from app.models.case_decision import CaseDecision
from app.schemas.decision import CaseDecisionCreate

class DecisionService:
    def __init__(self, db: Session):
        self.db = db

    def record_decision(self, payload: CaseDecisionCreate) -> CaseDecision:
        decision = CaseDecision(**payload.model_dump())
        self.db.add(decision)
        self.db.commit()
        self.db.refresh(decision)
        return decision

    def get_latest_decision(self, case_id: str) -> Optional[CaseDecision]:
        return self.db.query(CaseDecision).filter(CaseDecision.case_id == case_id).order_by(CaseDecision.created_at.desc()).first()
