from typing import Optional
from pydantic import BaseModel


class UpdateRoleRequest(BaseModel):
    role: str


class SetAiModeRequest(BaseModel):
    mode: str


class CreateAdminUserRequest(BaseModel):
    username: str
    password: str
    fullName: str
    role: Optional[str] = 'STUDENT'
    studentCode: Optional[str] = None
    department: Optional[str] = None
    email: Optional[str] = None
