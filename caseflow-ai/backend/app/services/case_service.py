import uuid
from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.repositories.case_repository import CaseRepository
from app.repositories.department_repository import DepartmentRepository
from app.models.case import Case
from app.schemas.case import CaseCreate, CaseResponse, CaseDetailResponse
from app.services.audit_log_service import AuditLogService

class CaseService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = CaseRepository(db)
        self.dept_repo = DepartmentRepository(db)
        self.audit_service = AuditLogService(db)

    def create_case(self, payload: CaseCreate, actor_name: str = "Student") -> CaseResponse:
        case_code = f"CASE-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        
        # Default department if not specified
        dept_id = payload.current_department_id
        if not dept_id:
            default_dept = self.dept_repo.get_by_code("STUDENT_SERVICES")
            dept_id = default_dept.id if default_dept else None

        case = Case(
            case_code=case_code,
            title=payload.title,
            description=payload.description,
            student_identifier=payload.student_identifier,
            case_type=payload.case_type,
            status="NEW",
            current_department_id=dept_id
        )
        saved = self.repo.create(case)

        # Audit log
        self.audit_service.log(
            case_id=saved.id,
            actor_type="STUDENT",
            actor_name=actor_name,
            action="SUBMITTED_CASE",
            input_snapshot={"title": payload.title, "student_id": payload.student_identifier, "type": payload.case_type},
            reason="Hồ sơ được sinh viên khởi tạo trên hệ thống CaseFlow."
        )

        return CaseResponse.model_validate(saved)

    def get_case_by_id(self, case_id: str) -> Optional[Case]:
        return self.repo.get_by_id(case_id)

    def get_case_detail(self, case_id: str) -> Optional[CaseDetailResponse]:
        case = self.repo.get_by_id(case_id)
        if not case:
            return None
        return CaseDetailResponse.model_validate(case)

    def list_cases(self, skip: int = 0, limit: int = 100, status: Optional[str] = None) -> List[CaseResponse]:
        items = self.repo.list_all(skip, limit, status)
        return [CaseResponse.model_validate(item) for item in items]

    def stop_workflow(self, case_id: str, reason: str, actor_name: str = "Staff") -> Case:
        case = self.repo.get_by_id(case_id)
        if not case:
            raise ValueError(f"Case {case_id} not found")
        case.status = "STOPPED"
        self.repo.update(case)

        self.audit_service.log(
            case_id=case_id,
            actor_type="STAFF",
            actor_name=actor_name,
            action="STOPPED_WORKFLOW",
            reason=reason,
            result_snapshot={"status": "STOPPED"}
        )
        return case

    def resume_workflow(self, case_id: str, reason: str, actor_name: str = "Staff") -> Case:
        case = self.repo.get_by_id(case_id)
        if not case:
            raise ValueError(f"Case {case_id} not found")
        case.status = "ANALYZING"
        self.repo.update(case)

        self.audit_service.log(
            case_id=case_id,
            actor_type="STAFF",
            actor_name=actor_name,
            action="RESUMED_WORKFLOW",
            reason=reason,
            result_snapshot={"status": "ANALYZING"}
        )
        return case
