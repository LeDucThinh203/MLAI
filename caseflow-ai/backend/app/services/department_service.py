from typing import List, Optional
from sqlalchemy.orm import Session
from app.repositories.department_repository import DepartmentRepository
from app.schemas.department import DepartmentResponse, DepartmentCreate
from app.models.department import Department

class DepartmentService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = DepartmentRepository(db)

    def list_departments(self) -> List[DepartmentResponse]:
        items = self.repo.list_all()
        return [DepartmentResponse.model_validate(d) for d in items]

    def get_by_code(self, code: str) -> Optional[DepartmentResponse]:
        dept = self.repo.get_by_code(code)
        return DepartmentResponse.model_validate(dept) if dept else None

    def create_department(self, payload: DepartmentCreate) -> DepartmentResponse:
        dept = Department(**payload.model_dump())
        saved = self.repo.create(dept)
        return DepartmentResponse.model_validate(saved)
