from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.case import Case

class CaseRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, case_id: str) -> Optional[Case]:
        return self.db.query(Case).filter(Case.id == case_id).first()

    def get_by_code(self, case_code: str) -> Optional[Case]:
        return self.db.query(Case).filter(Case.case_code == case_code).first()

    def list_all(self, skip: int = 0, limit: int = 100, status: Optional[str] = None) -> List[Case]:
        query = self.db.query(Case)
        if status:
            query = query.filter(Case.status == status)
        return query.order_by(Case.created_at.desc()).offset(skip).limit(limit).all()

    def count(self, status: Optional[str] = None) -> int:
        query = self.db.query(Case)
        if status:
            query = query.filter(Case.status == status)
        return query.count()

    def create(self, case: Case) -> Case:
        self.db.add(case)
        self.db.commit()
        self.db.refresh(case)
        return case

    def update(self, case: Case) -> Case:
        self.db.commit()
        self.db.refresh(case)
        return case
