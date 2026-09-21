from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.verification_run import VerificationRun
from app.models.verification_result import VerificationResult

class VerificationRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_run(self, run: VerificationRun) -> VerificationRun:
        self.db.add(run)
        self.db.commit()
        self.db.refresh(run)
        return run

    def update_run(self, run: VerificationRun) -> VerificationRun:
        self.db.commit()
        self.db.refresh(run)
        return run

    def get_run_by_id(self, run_id: str) -> Optional[VerificationRun]:
        return self.db.query(VerificationRun).filter(VerificationRun.id == run_id).first()

    def list_runs(self, limit: int = 50) -> List[VerificationRun]:
        return self.db.query(VerificationRun).order_by(VerificationRun.created_at.desc()).limit(limit).all()

    def add_result(self, result: VerificationResult) -> VerificationResult:
        self.db.add(result)
        self.db.commit()
        self.db.refresh(result)
        return result

    def get_results_by_run(self, run_id: str) -> List[VerificationResult]:
        return self.db.query(VerificationResult).filter(VerificationResult.run_id == run_id).all()
