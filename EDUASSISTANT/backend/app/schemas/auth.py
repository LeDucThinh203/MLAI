from typing import Optional
from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str
    twoFactorCode: Optional[str] = None
    otpCode: Optional[str] = None


class Login2FARequest(BaseModel):
    tempToken: Optional[str] = None
    otpCode: Optional[str] = None
    userId: Optional[str] = None


class RegisterRequest(BaseModel):
    username: str
    password: str
    fullName: Optional[str] = None
    email: Optional[str] = None
    studentCode: Optional[str] = None
    role: Optional[str] = 'STUDENT'
    department: Optional[str] = None
    mustChangePassword: Optional[bool] = False


class RefreshRequest(BaseModel):
    refreshToken: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    oldPassword: str
    newPassword: str
    confirmPassword: Optional[str] = None


class UpdateProfileRequest(BaseModel):
    fullName: Optional[str] = None
    email: Optional[str] = None
    department: Optional[str] = None
    bio: Optional[str] = None


class DeleteAccountRequest(BaseModel):
    password: Optional[str] = ''


class Enable2FARequest(BaseModel):
    token: Optional[str] = None
    otpCode: Optional[str] = None
    secret: Optional[str] = None
