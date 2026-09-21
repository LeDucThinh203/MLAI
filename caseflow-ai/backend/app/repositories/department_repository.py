from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.department import Department

class DepartmentRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, dept_id: str) -> Optional[Department]:
        return self.db.query(Department).filter(Department.id == dept_id).first()

    def get_by_code(self, code: str) -> Optional[Department]:
        return self.db.query(Department).filter(Department.code == code).first()

    def list_all(self, active_only: bool = True) -> List[Department]:
        query = self.db.query(Department)
        if active_only:
            query = query.filter(Department.is_active == True)
        return query.order_by(Department.code.asc()).all()

    def create(self, dept: Department) -> Department:
        self.db.add(dept)
        self.db.commit()
        self.db.refresh(dept)
        return dept
