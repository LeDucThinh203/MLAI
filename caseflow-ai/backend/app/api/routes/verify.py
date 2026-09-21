from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.verification import VerificationRunResponse
from app.services.verification_service import VerificationService

router = APIRouter(prefix="/verify", tags=["Verify"])

@router.post("/run", response_model=VerificationRunResponse)
async def run_verification_suite(db: Session = Depends(get_db)):
    """Executes all test cases through real engine pipeline."""
    service = VerificationService(db)
    run = await service.run_all_tests()
    return run

@router.get("/runs", response_model=List[VerificationRunResponse])
def list_verification_runs(db: Session = Depends(get_db)):
    service = VerificationService(db)
    return service.list_runs()

@router.get("/runs/{id}", response_model=VerificationRunResponse)
def get_verification_run(id: str, db: Session = Depends(get_db)):
    service = VerificationService(db)
    run = service.get_run(id)
    if not run:
        raise HTTPException(status_code=404, detail="Verification run not found")
    return run
