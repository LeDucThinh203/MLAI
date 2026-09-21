from typing import Optional, List
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.escalation import Escalation
from app.schemas.escalation import EscalationCreate, EscalationResponse

class EscalationService:
    def __init__(self, db: Session):
        self.db = db

    def create_escalation(self, payload: EscalationCreate) -> Escalation:
        escalation = Escalation(**payload.model_dump())
        self.db.add(escalation)
        self.db.commit()
        self.db.refresh(escalation)
        return escalation

    def get_by_id(self, escalation_id: str) -> Optional[Escalation]:
        return self.db.query(Escalation).filter(Escalation.id == escalation_id).first()

    def get_pending_by_case(self, case_id: str) -> Optional[Escalation]:
        return self.db.query(Escalation).filter(Escalation.case_id == case_id, Escalation.status == "PENDING").first()

    def resolve_escalation(self, escalation_id: str) -> Escalation:
        esc = self.get_by_id(escalation_id)
        if esc:
            esc.status = "RESOLVED"
            esc.resolved_at = datetime.now(timezone.utc)
            self.db.commit()
            self.db.refresh(esc)
        return esc
