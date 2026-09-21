from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.evidence import Evidence
from app.models.evidence_extraction import EvidenceExtraction
from app.models.evidence_comparison import EvidenceComparison

class EvidenceRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, evidence_id: str) -> Optional[Evidence]:
        return self.db.query(Evidence).filter(Evidence.id == evidence_id).first()

    def list_by_case(self, case_id: str) -> List[Evidence]:
        return self.db.query(Evidence).filter(Evidence.case_id == case_id).order_by(Evidence.uploaded_at.asc()).all()

    def create(self, evidence: Evidence) -> Evidence:
        self.db.add(evidence)
        self.db.commit()
        self.db.refresh(evidence)
        return evidence

    def create_extraction(self, extraction: EvidenceExtraction) -> EvidenceExtraction:
        self.db.add(extraction)
        self.db.commit()
        self.db.refresh(extraction)
        return extraction

    def get_extractions_by_evidence(self, evidence_id: str) -> List[EvidenceExtraction]:
        return self.db.query(EvidenceExtraction).filter(EvidenceExtraction.evidence_id == evidence_id).all()

    def create_comparison(self, comparison: EvidenceComparison) -> EvidenceComparison:
        self.db.add(comparison)
        self.db.commit()
        self.db.refresh(comparison)
        return comparison

    def list_comparisons_by_case(self, case_id: str) -> List[EvidenceComparison]:
        return self.db.query(EvidenceComparison).filter(EvidenceComparison.case_id == case_id).all()
