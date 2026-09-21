from typing import List, Optional
from sqlalchemy.orm import Session
from app.repositories.policy_repository import PolicyRepository
from app.schemas.policy import PolicyResponse, PolicyCreate
from app.models.policy import Policy

class PolicyService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = PolicyRepository(db)

    def list_policies(self) -> List[PolicyResponse]:
        items = self.repo.list_all()
        return [PolicyResponse.model_validate(p) for p in items]

    def get_by_id(self, policy_id: str) -> Optional[PolicyResponse]:
        item = self.repo.get_by_id(policy_id)
        return PolicyResponse.model_validate(item) if item else None

    def get_by_code(self, code: str) -> Optional[PolicyResponse]:
        item = self.repo.get_by_code(code)
        return PolicyResponse.model_validate(item) if item else None
