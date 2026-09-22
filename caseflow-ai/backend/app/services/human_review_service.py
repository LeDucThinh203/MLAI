from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from app.repositories.human_review_repository import HumanReviewRepository
from app.repositories.case_repository import CaseRepository
from app.models.human_review import HumanReview
from app.schemas.human_review import HumanReviewResponse, HumanReviewActionRequest
from app.services.audit_log_service import AuditLogService
from app.services.escalation_service import EscalationService

class HumanReviewService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = HumanReviewRepository(db)
        self.case_repo = CaseRepository(db)
        self.audit_service = AuditLogService(db)
        self.escalation_service = EscalationService(db)

    def process_action(
        self,
        case_id: str,
        action: str,  # APPROVE, REJECT, OVERRIDE, REQUEST_INFORMATION, STOP, RESUME
        payload: HumanReviewActionRequest
    ) -> HumanReviewResponse:
        case = self.case_repo.get_by_id(case_id)
        if not case:
            raise ValueError(f"Case {case_id} not found")

        # Record human review entry
        review = HumanReview(
            case_id=case_id,
            reviewer_name=payload.reviewer_name,
            reviewer_role=payload.reviewer_role,
            decision=action,
            reason=payload.reason
        )
        saved_review = self.repo.create_review(review)

        # Update case status based on action
        status_map = {
            "APPROVE": "APPROVED",
            "REJECT": "REJECTED",
            "OVERRIDE": "APPROVED",
            "REQUEST_INFORMATION": "WAITING_FOR_INFORMATION",
            "STOP": "STOPPED",
            "RESUME": "ANALYZING"
        }
        case.status = status_map.get(action, case.status)
        if action in ["APPROVE", "REJECT", "OVERRIDE"]:
            case.resolved_at = datetime.now(timezone.utc)

        # Resolve pending escalation if any
        pending_esc = self.escalation_service.get_pending_by_case(case_id)
        if pending_esc and action in ["APPROVE", "REJECT", "OVERRIDE", "REQUEST_INFORMATION"]:
            self.escalation_service.resolve_escalation(pending_esc.id)

        self.case_repo.update(case)

        # Log audit
        self.audit_service.log(
            case_id=case_id,
            actor_type="STAFF",
            actor_name=f"{payload.reviewer_name} ({payload.reviewer_role})",
            action=f"HUMAN_REVIEW_{action}",
            input_snapshot={"action": action, "reason": payload.reason},
            reason=payload.reason,
            result_snapshot={"new_status": case.status}
        )

        return HumanReviewResponse.model_validate(saved_review)

    def list_pending_reviews(self, skip: int = 0, limit: int = 50):
        return self.repo.list_pending_escalations(skip, limit)
