from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.audit_log import AuditLogResponse
from app.services.audit_log_service import AuditLogService

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])

@router.get("", response_model=List[AuditLogResponse])
def list_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """
    Query the tamper-evident audit trail answering:
    WHO, WHAT, WHEN, INPUT, EVIDENCE, WHY, POLICY, RESULT.
    """
    service = AuditLogService(db)
    return service.list_all(skip, limit)
