from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.services.case_service import CaseService
from app.services.evidence_service import EvidenceService
from app.services.case_analysis_service import CaseAnalysisService

class CaseOrchestrator:
    """Coordinates end-to-end multi-step workflow execution."""

    def __init__(self, db: Session):
        self.db = db
        self.case_service = CaseService(db)
        self.evidence_service = EvidenceService(db)
        self.analysis_service = CaseAnalysisService(db)

    async def ingest_and_analyze(
        self,
        case_id: str,
        evidence_id: Optional[str] = None
    ) -> Dict[str, Any]:
        # 1. Analyze evidence if pending
        if evidence_id:
            await self.evidence_service.analyze_evidence(evidence_id)
            
        # 2. Run case analysis and decision pipeline
        result = await self.analysis_service.analyze_case(case_id)
        return result
