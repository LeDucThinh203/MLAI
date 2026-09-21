from typing import List, Optional, Dict, Any
import json
from sqlalchemy.orm import Session
from app.repositories.audit_repository import AuditRepository
from app.models.audit_log import AuditLog
from app.schemas.audit_log import AuditLogResponse
from app.core.logging import logger

class AuditLogService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = AuditRepository(db)

    def log(
        self,
        case_id: str,
        actor_type: str,
        actor_name: str,
        action: str,
        input_snapshot: Optional[Dict[str, Any]] = None,
        evidence_ids: Optional[List[str]] = None,
        reason: Optional[str] = None,
        policy_reference: Optional[str] = None,
        result_snapshot: Optional[Dict[str, Any]] = None,
    ) -> AuditLog:
        """Enforces accountable, immutable logging."""
        audit_entry = AuditLog(
            case_id=case_id,
            actor_type=actor_type,
            actor_name=actor_name,
            action=action,
            input_snapshot=json.dumps(input_snapshot, ensure_ascii=False) if input_snapshot else None,
            evidence_ids=",".join(evidence_ids) if evidence_ids else None,
            reason=reason,
            policy_reference=policy_reference,
            result_snapshot=json.dumps(result_snapshot, ensure_ascii=False) if result_snapshot else None,
        )
        logger.info(f"Audit: [{actor_type}] {actor_name} -> {action} for Case {case_id}")
        return self.repo.create(audit_entry)

    def list_by_case(self, case_id: str) -> List[AuditLogResponse]:
        items = self.repo.list_by_case(case_id)
        return [AuditLogResponse.model_validate(item) for item in items]

    def list_all(self, skip: int = 0, limit: int = 100) -> List[AuditLogResponse]:
        items = self.repo.list_all(skip, limit)
        return [AuditLogResponse.model_validate(item) for item in items]
