from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

class PolicyRuleBase(BaseModel):
    rule_code: str
    name: str
    description: str
    condition_type: str
    condition_value: str
    action: str
    priority: int = 100
    is_active: bool = True

class PolicyRuleCreate(PolicyRuleBase):
    policy_id: str

class PolicyRuleResponse(PolicyRuleBase):
    id: str
    policy_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class PolicyBase(BaseModel):
    code: str
    name: str
    description: str
    version: str = "1.0"
    is_active: bool = True

class PolicyCreate(PolicyBase):
    pass

class PolicyResponse(PolicyBase):
    id: str
    created_at: datetime
    updated_at: datetime
    rules: List[PolicyRuleResponse] = []

    model_config = ConfigDict(from_attributes=True)
