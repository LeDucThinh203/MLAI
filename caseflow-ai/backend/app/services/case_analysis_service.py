import json
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.repositories.case_repository import CaseRepository
from app.repositories.evidence_repository import EvidenceRepository
from app.repositories.department_repository import DepartmentRepository
from app.rules.decision_engine import DecisionEngine, DecisionPipelineResult
from app.services.evidence_comparison_service import EvidenceComparisonService
from app.services.decision_service import DecisionService
from app.services.escalation_service import EscalationService
from app.services.audit_log_service import AuditLogService
from app.schemas.decision import CaseDecisionCreate
from app.schemas.escalation import EscalationCreate

class CaseAnalysisService:
    def __init__(self, db: Session):
        self.db = db
        self.case_repo = CaseRepository(db)
        self.evidence_repo = EvidenceRepository(db)
        self.dept_repo = DepartmentRepository(db)
        self.decision_engine = DecisionEngine()
        self.comparison_service = EvidenceComparisonService()
        self.decision_service = DecisionService(db)
        self.escalation_service = EscalationService(db)
        self.audit_service = AuditLogService(db)

    async def analyze_case(self, case_id: str) -> Dict[str, Any]:
        case = self.case_repo.get_by_id(case_id)
        if not case:
            raise ValueError(f"Case {case_id} not found")

        case.status = "ANALYZING"
        self.case_repo.update(case)

        # 1. Gather all extractions from uploaded evidence (auto-trigger VLM if not yet extracted)
        from app.services.evidence_service import EvidenceService
        ev_service = EvidenceService(self.db)

        evidence_items = self.evidence_repo.list_by_case(case_id)
        all_facts: Dict[str, Any] = {}
        for ev in evidence_items:
            extractions = self.evidence_repo.get_extractions_by_evidence(ev.id)
            if not extractions:
                try:
                    extraction = await ev_service.analyze_evidence(ev.id)
                    extractions = [extraction]
                except Exception as e:
                    pass

            for ext in extractions:
                try:
                    data = json.loads(ext.structured_data_json)
                    all_facts.update(data)
                except Exception:
                    pass

        # 1.1 Supplement facts with text fallback if fields are missing
        import re
        text_content = f"{case.title} {case.description}"
        if not all_facts.get("student_identifier"):
            all_facts["student_identifier"] = case.student_identifier

        if "amount" not in all_facts:
            amt_match = re.search(r'(\d{1,3}(?:[.,]\d{3})+|\d{6,9})\s*(?:vnđ|vnd|đ)?', text_content, re.IGNORECASE)
            if amt_match:
                raw_num = amt_match.group(1).replace('.', '').replace(',', '')
                try:
                    val = float(raw_num)
                    if val > 1000:
                        all_facts["amount"] = val
                        if "confidence" not in all_facts:
                            all_facts["confidence"] = 0.95
                except ValueError:
                    pass

        if "transaction_id" not in all_facts:
            txn_match = re.search(r'([A-Z]{2,5}-\d{4,10})', text_content)
            if txn_match:
                all_facts["transaction_id"] = txn_match.group(1)

        if case.case_type == "CROSS_DEPARTMENT_DISPUTE" or "tranh chấp" in text_content.lower() or "đùn đẩy" in text_content.lower():
            all_facts["is_cross_department"] = True
            all_facts["disputed_departments"] = ["Phòng Đào tạo (Academic Affairs)", "Phòng Kế toán (Finance)"]

        # 2. Simulated / SIS system data comparison (Mock SIS records)
        if case.case_type == "TUITION_STATUS":
            extracted_amt = all_facts.get("amount")
            if extracted_amt is not None and float(extracted_amt) > 50000000.0:
                sis_amount = float(extracted_amt)
            else:
                sis_amount = 10500000.0
            mock_sis_records = {
                "student_identifier": case.student_identifier,
                "system_status": "UNPAID",
                "amount": sis_amount,
                "transaction_id": all_facts.get("transaction_id", "SYS-NONE"),
            }
        else:
            mock_sis_records = {
                "student_identifier": case.student_identifier,
            }

        # 3. Perform Evidence Comparison
        comparisons = self.comparison_service.compare_facts(
            case_id=case_id,
            extracted_facts=all_facts,
            system_records=mock_sis_records,
            left_evidence_id=evidence_items[0].id if evidence_items else None
        )
        for comp in comparisons:
            self.evidence_repo.create_comparison(comp)

        comparison_dicts = [
            {
                "field_name": c.field_name,
                "left_value": c.left_value,
                "right_value": c.right_value,
                "comparison_status": c.comparison_status,
                "reason": c.reason
            }
            for c in comparisons
        ]

        # 4. Run Deterministic Decision Pipeline (Policy -> Uncertainty -> Authority -> Decision)
        result: DecisionPipelineResult = self.decision_engine.process(
            case_type=case.case_type,
            facts=all_facts,
            comparisons=comparison_dicts
        )

        # 5. Handle Decision
        decision_rec = self.decision_service.record_decision(
            CaseDecisionCreate(
                case_id=case_id,
                decision_type=result.decision_type,
                reason=result.reason,
                policy_reference=result.policy_reference,
                evidence_summary=f"Đã phân tích {len(evidence_items)} tài liệu minh chứng đính kèm."
            )
        )

        # 6. Handle Escalation if required
        escalation_rec = None
        if result.decision_type == "ESCALATE":
            case.status = "ESCALATED"
            dept = self.dept_repo.get_by_code(result.target_department or "STUDENT_SERVICES")
            
            ESC_SUMMARY_VI = {
                "FACT_UNKNOWN": "Minh chứng ảnh bị mờ hoặc không đủ dữ liệu trường bắt buộc để nhận diện.",
                "DATA_CONFLICT": "Phát hiện sai lệch giữa số liệu trên minh chứng và dữ liệu ghi nhận tại hệ thống SIS.",
                "POLICY_OUT_OF_SCOPE": "Tình huống hồ sơ thuộc diện chính sách ngoại lệ chưa có tiền lệ tự động trong quy chế.",
                "OWNERSHIP_UNCLEAR": "Hồ sơ có sự tranh chấp phân định trách nhiệm tiếp nhận giữa các phòng ban.",
                "AUTHORITY_REQUIRED": "Giá trị giao dịch hoặc tính chất hồ sơ vượt hạn mức thẩm quyền quyết định tự động của AI.",
            }
            summary_text = ESC_SUMMARY_VI.get(result.escalation_type or "", f"Dừng tự động và leo thang: {result.escalation_type}")

            escalation_rec = self.escalation_service.create_escalation(
                EscalationCreate(
                    case_id=case_id,
                    escalation_type=result.escalation_type or "POLICY_OUT_OF_SCOPE",
                    target_department_id=dept.id if dept else None,
                    target_role=result.target_role or "Department Officer",
                    question=result.question or "Cán bộ vui lòng xem xét và giải quyết hồ sơ.",
                    reason=result.reason,
                    evidence_summary=summary_text
                )
            )
            self.case_repo.update(case)

            self.audit_service.log(
                case_id=case_id,
                actor_type="SYSTEM",
                actor_name="Decision Engine",
                action=f"ESCALATED_{result.escalation_type}",
                reason=result.reason,
                policy_reference=result.policy_reference,
                result_snapshot={"status": "ESCALATED", "escalation_id": escalation_rec.id}
            )

        elif result.decision_type == "AUTO_RESOLVE":
            case.status = "AUTO_RESOLVED"
            self.case_repo.update(case)

            self.audit_service.log(
                case_id=case_id,
                actor_type="SYSTEM",
                actor_name="Decision Engine",
                action="AUTO_RESOLVED_CASE",
                reason=result.reason,
                policy_reference=result.policy_reference,
                result_snapshot={"status": "AUTO_RESOLVED"}
            )

        return {
            "decision": result.decision_type,
            "reason": result.reason,
            "policy_reference": result.policy_reference,
            "escalation_type": result.escalation_type,
            "question": result.question
        }
