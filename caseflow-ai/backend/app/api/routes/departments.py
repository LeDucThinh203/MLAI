from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.department import DepartmentResponse
from app.services.department_service import DepartmentService

router = APIRouter(prefix="/departments", tags=["Departments"])

@router.get("", response_model=List[DepartmentResponse])
def list_departments(db: Session = Depends(get_db)):
    service = DepartmentService(db)
    return service.list_departments()
