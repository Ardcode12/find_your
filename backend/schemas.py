from datetime import datetime
from enum import Enum
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class UserRole(str, Enum):
    STUDENT = "student"
    STAFF = "staff"
    NON_TEACHING_STAFF = "non_teaching_staff"
    DEPARTMENT_ADMIN = "department_admin"
    ADMIN = "admin"


class SignupRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Full Name of the user")
    email: str = Field(..., description="Institutional email ending with @kongu.edu")
    password: str = Field(..., min_length=6, description="Password (minimum 6 characters)")
    confirm_password: Optional[str] = Field(None, description="Confirmation password")
    role: UserRole = Field(UserRole.STUDENT, description="Campus role")
    department: Optional[str] = Field(None, description="Department name (e.g. CSE, IT, ECE)")
    department_code: Optional[str] = Field(None, description="Department code")
    phone: Optional[str] = Field(None, description="Phone number")

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
    department: Optional[str] = None
    department_code: Optional[str] = None
    phone: Optional[str] = None
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
# Department Schemas
# ==========================================
class DepartmentCreate(BaseModel):
    code: str = Field(..., min_length=2, max_length=20)
    name: str = Field(..., min_length=2, max_length=150)
    office_location: Optional[str] = None
    hod_email: Optional[str] = None


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    office_location: Optional[str] = None
    hod_email: Optional[str] = None


class DepartmentOut(BaseModel):
    id: int
    code: str
    name: str
    hod_email: Optional[str] = None
    office_location: Optional[str] = None
    created_at: datetime


class EscalationHistoryOut(BaseModel):
    id: int
    item_id: int
    from_level: str
    to_level: str
    reason: Optional[str] = None
    escalated_by: str
    created_at: datetime


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
    assigned_department: Optional[str] = None
    assigned_department_name: Optional[str] = None
    escalation_level: Optional[str] = "user"
    assigned_office: Optional[str] = None
    escalation_at: Optional[datetime] = None
    dept_received_at: Optional[datetime] = None
    admin_received_at: Optional[datetime] = None
    handover_at: Optional[datetime] = None
    handover_by: Optional[str] = None
    owner_name: Optional[str] = None
    owner_roll_no: Optional[str] = None
    owner_phone: Optional[str] = None
    owner_id_card_image: Optional[str] = None
    handover_notes: Optional[str] = None
    private_verification_detail: Optional[str] = None
    contact_preference: Optional[str] = "chat_only"
    is_public: Optional[bool] = True
    withdrawn: Optional[bool] = False
    matches_count: Optional[int] = 0
    claims_count: Optional[int] = 0
    created_at: datetime


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


class ItemEscalateRequest(BaseModel):
    target_department_code: Optional[str] = None
    reason: Optional[str] = None


class ItemHandoverRequest(BaseModel):
    owner_name: str = Field(..., min_length=2, description="Name of the owner receiving the item")
    owner_roll_no: str = Field(..., min_length=2, description="Roll Number of the owner")
    owner_phone: str = Field(..., min_length=5, description="Phone Number of the owner")
    handover_date: Optional[str] = Field(None, description="Handover / Submission date (YYYY-MM-DD)")
    owner_id_card_image: Optional[str] = Field(None, description="Item owner ID card image URL/base64 (Required ONLY for student-to-student handover)")
    handover_by: Optional[str] = Field(None, description="Staff or student conducting the handover")
    notes: Optional[str] = Field(None, description="Additional verification notes")


# ==========================================
# Admin Analytics Schemas
# ==========================================
class DeptStats(BaseModel):
    department_code: str
    department_name: str
    total: int
    pending: int
    recovered: int
    at_admin: int


class AdminAnalyticsOut(BaseModel):
    total_items: int
    total_found: int
    total_lost: int
    total_recovered: int
    total_at_departments: int
    total_at_admin: int
    total_valuable: int
    recovery_rate: float
    by_department: List[DeptStats]
    by_category: List[dict]
    by_status: List[dict]
    recent_escalations: List[dict]


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
    owner_name: Optional[str] = None
    owner_roll_no: Optional[str] = None
    owner_phone: Optional[str] = None
    handover_date: Optional[str] = None
    owner_id_card_image: Optional[str] = None
    notes: Optional[str] = None


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


# ==========================================
# Gemini AI Analysis
# ==========================================
class GeminiAnalysisRequest(BaseModel):
    image_url: Optional[str] = None
    image_base64: Optional[str] = None


class GeminiAnalysisOut(BaseModel):
    title: str
    category: str
    description: str
    is_valuable: bool
    confidence: float
    tags: List[str] = []
