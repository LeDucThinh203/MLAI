from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog

class AuditRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, log: AuditLog) -> AuditLog:
        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)
        return log

    def list_by_case(self, case_id: str) -> List[AuditLog]:
        return self.db.query(AuditLog).filter(AuditLog.case_id == case_id).order_by(AuditLog.created_at.asc()).all()

    def list_all(self, skip: int = 0, limit: int = 100) -> List[AuditLog]:
        return self.db.query(AuditLog).order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()

    def count(self) -> int:
        return self.db.query(AuditLog).count()
