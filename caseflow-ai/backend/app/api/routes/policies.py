from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.policy import PolicyResponse
from app.services.policy_service import PolicyService

router = APIRouter(prefix="/policies", tags=["Policies"])

@router.get("", response_model=List[PolicyResponse])
def list_policies(db: Session = Depends(get_db)):
    service = PolicyService(db)
    return service.list_policies()

@router.get("/{id}", response_model=PolicyResponse)
def get_policy(id: str, db: Session = Depends(get_db)):
    service = PolicyService(db)
    policy = service.get_by_id(id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return policy
