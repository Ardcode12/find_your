from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

class UserRole(str, Enum):
    STUDENT = "student"
    STAFF = "staff"
    NON_TEACHING_STAFF = "non_teaching_staff"
    ADMIN = "admin"

class SignupRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Full Name of the user")
    email: str = Field(..., description="Institutional email ending with @kongu.edu")
    password: str = Field(..., min_length=6, description="Password (minimum 6 characters)")
    confirm_password: Optional[str] = Field(None, description="Confirmation password")
    role: UserRole = Field(UserRole.STUDENT, description="Campus role")

    @field_validator("email")
    @classmethod
    def validate_kongu_email(cls, v: str) -> str:
        clean_email = v.strip().lower()
        if not clean_email.endswith("@kongu.edu"):
            raise ValueError("Only official institutional emails ending with @kongu.edu are allowed.")
        return clean_email

    @model_validator(mode="after")
    def validate_passwords_match(self):
        if self.confirm_password is not None and self.password != self.confirm_password:
            raise ValueError("Password and Confirm Password do not match.")
        return self

class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def clean_email(cls, v: str) -> str:
        return v.strip().lower()

class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    created_at: datetime

class AuthResponse(BaseModel):
    message: str
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class CategoryItem(BaseModel):
    id: str
    title: str
    count: int
    icon: str
    description: Optional[str] = None
    priority: bool = False
