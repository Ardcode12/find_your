from datetime import datetime
from enum import Enum
from typing import List, Optional, Any, Dict
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
    phone_number: Optional[str] = None
    contact_preference: Optional[str] = "chat_only"
    notify_matches: Optional[bool] = True
    notify_claims: Optional[bool] = True
    notify_messages: Optional[bool] = True
    notify_email: Optional[bool] = False
    avatar_url: Optional[str] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone_number: Optional[str] = None
    contact_preference: Optional[str] = None
    notify_matches: Optional[bool] = None
    notify_claims: Optional[bool] = None
    notify_messages: Optional[bool] = None
    notify_email: Optional[bool] = None
    avatar_url: Optional[str] = None

class PasswordChangeRequest(BaseModel):
    current_password: str = Field(..., min_length=6)
    new_password: str = Field(..., min_length=6)
    confirm_new_password: Optional[str] = None

class UserStatsOut(BaseModel):
    items_reported: int
    items_recovered: int
    active_matches: int

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

# ==========================================
# Items & Reports Schemas
# ==========================================
class PhotoAnalysisRequest(BaseModel):
    image_url: str

class PhotoAnalysisResponse(BaseModel):
    suggested_name: str
    suggested_category: str
    suggested_description: str
    is_valuable: bool

class ItemCreate(BaseModel):
    report_type: str = Field("found", description="'lost' or 'found'")
    title: str = Field(..., min_length=2, max_length=255)
    category: str
    description: str
    image_url: Optional[str] = None
    location: str
    incident_date: Optional[str] = None
    incident_time: Optional[str] = None
    is_valuable: bool = False
    private_verification_detail: Optional[str] = None
    contact_preference: Optional[str] = "chat_only"

class ItemUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    incident_date: Optional[str] = None
    incident_time: Optional[str] = None
    is_valuable: Optional[bool] = None

class ItemOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    report_type: str
    title: str
    category: str
    description: str
    image_url: Optional[str] = None
    location: str
    incident_date: Optional[str] = None
    incident_time: Optional[str] = None
    is_valuable: bool
    status: str
    reporter_name: str
    reporter_role: str
    contact_note: Optional[str] = None
    private_verification_detail: Optional[str] = None
    contact_preference: Optional[str] = "chat_only"
    is_public: Optional[bool] = True
    withdrawn: Optional[bool] = False
    created_at: datetime
    matches_count: Optional[int] = 0
    claims_count: Optional[int] = 0

class ItemCreateResponse(BaseModel):
    item: ItemOut
    message: str
    matches: List[ItemOut] = []

# ==========================================
# Matches Schemas
# ==========================================
class MatchOut(BaseModel):
    id: int
    lost_item: ItemOut
    found_item: ItemOut
    similarity_score: int
    stage: str # 'verification_pending', 'chat_open', 'handover_scheduled', 'recovered'
    created_at: datetime

# ==========================================
# Chat & Messaging Schemas
# ==========================================
class MessageCreate(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)

class MessageOut(BaseModel):
    id: int
    item_id: int
    sender_id: Optional[int] = None
    sender_name: str
    sender_role: str
    message: str
    is_system: bool = False
    created_at: datetime

# ==========================================
# Ownership Verification Claims
# ==========================================
class ClaimCreate(BaseModel):
    hidden_details: str = Field(..., min_length=5, max_length=2000, description="2-3 details not visible in photo")

class ClaimOut(BaseModel):
    id: int
    item_id: int
    claimant_id: Optional[int] = None
    claimant_name: str
    claimant_role: str
    hidden_details: str
    status: str
    created_at: datetime

class ClaimVerifyRequest(BaseModel):
    approved: bool

# ==========================================
# My Activity & Notifications
# ==========================================
class ActivityStatsOut(BaseModel):
    lost: int
    found: int
    active_matches: int
    recovered: int

class ActivitySummary(BaseModel):
    summary_stats: ActivityStatsOut
    my_lost_reports: List[ItemOut]
    my_found_reports: List[ItemOut]
    my_matches: List[MatchOut]
    recovered_history: List[ItemOut]

class NotificationOut(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    type: str
    item_id: Optional[int] = None
    item_image: Optional[str] = None
    item_title: Optional[str] = None
    is_read: bool
    created_at: datetime
