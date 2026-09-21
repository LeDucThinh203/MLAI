from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.policy import Policy
from app.models.policy_rule import PolicyRule

class PolicyRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, policy_id: str) -> Optional[Policy]:
        return self.db.query(Policy).filter(Policy.id == policy_id).first()

    def get_by_code(self, code: str) -> Optional[Policy]:
        return self.db.query(Policy).filter(Policy.code == code).first()

    def list_all(self, active_only: bool = True) -> List[Policy]:
        query = self.db.query(Policy)
        if active_only:
            query = query.filter(Policy.is_active == True)
        return query.all()

    def create(self, policy: Policy) -> Policy:
        self.db.add(policy)
        self.db.commit()
        self.db.refresh(policy)
        return policy

    def add_rule(self, rule: PolicyRule) -> PolicyRule:
        self.db.add(rule)
        self.db.commit()
        self.db.refresh(rule)
        return rule

    def list_rules_by_policy(self, policy_id: str) -> List[PolicyRule]:
        return self.db.query(PolicyRule).filter(PolicyRule.policy_id == policy_id, PolicyRule.is_active == True).order_by(PolicyRule.priority.asc()).all()
