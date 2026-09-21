from typing import List, Optional
from sqlalchemy.orm import Session
from app.repositories.evidence_repository import EvidenceRepository
from app.models.evidence import Evidence
from app.models.evidence_extraction import EvidenceExtraction
from app.schemas.evidence import EvidenceResponse
from app.services.evidence_validation_service import EvidenceValidationService
from app.services.evidence_analysis_service import EvidenceAnalysisService
from app.services.audit_log_service import AuditLogService

class EvidenceService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = EvidenceRepository(db)
        self.validation_service = EvidenceValidationService()
        self.analysis_service = EvidenceAnalysisService()
        self.audit_service = AuditLogService(db)

    async def upload_evidence(
        self,
        case_id: str,
        original_filename: str,
        content_type: str,
        file_bytes: bytes,
        evidence_type: str = "RECEIPT",
        source_description: Optional[str] = None,
        actor_name: str = "Student"
    ) -> Evidence:
        # 1. Validate and store to disk securely
        stored_name, path, sha256_hash, size = self.validation_service.validate_and_save(
            original_filename, content_type, file_bytes
        )

        # 2. Persist Evidence metadata
        evidence = Evidence(
            case_id=case_id,
            evidence_type=evidence_type,
            original_file_name=original_filename,
            stored_file_name=stored_name,
            mime_type=content_type,
            file_size=size,
            sha256_hash=sha256_hash,
            storage_path=path,
            source_description=source_description,
            analysis_status="PENDING"
        )
        saved = self.repo.create(evidence)

        # 3. Audit log
        self.audit_service.log(
            case_id=case_id,
            actor_type="STUDENT",
            actor_name=actor_name,
            action="UPLOADED_EVIDENCE",
            input_snapshot={"original_name": original_filename, "mime": content_type, "size": size},
            evidence_ids=[saved.id],
            reason="Minh chứng mới được tải lên hệ thống."
        )

        return saved

    async def analyze_evidence(self, evidence_id: str) -> EvidenceExtraction:
        evidence = self.repo.get_by_id(evidence_id)
        if not evidence:
            raise ValueError(f"Evidence {evidence_id} not found")

        # Call VLM analysis
        extraction = await self.analysis_service.analyze_evidence_file(
            evidence_id=evidence.id,
            file_path=evidence.storage_path,
            mime_type=evidence.mime_type,
            evidence_type=evidence.evidence_type,
            original_filename=evidence.original_file_name
        )
        
        saved_extraction = self.repo.create_extraction(extraction)
        evidence.analysis_status = "ANALYZED"
        self.db.commit()

        # Audit log
        self.audit_service.log(
            case_id=evidence.case_id,
            actor_type="AI_VLM",
            actor_name="Gemini VLM",
            action="EXTRACTED_FACTS",
            input_snapshot={"evidence_id": evidence_id, "file": evidence.original_file_name},
            evidence_ids=[evidence.id],
            reason="Trích xuất các trường dữ kiện có cấu trúc từ minh chứng thị giác."
        )

        return saved_extraction

    def get_by_id(self, evidence_id: str) -> Optional[Evidence]:
        return self.repo.get_by_id(evidence_id)

    def list_by_case(self, case_id: str) -> List[Evidence]:
        return self.repo.list_by_case(case_id)
