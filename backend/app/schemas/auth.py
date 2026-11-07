from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator

CURRENT_TERMS_VERSION = "2026.1"
CURRENT_PRIVACY_VERSION = "2026.1"
CURRENT_AI_CONSENT_VERSION = "2026.1"

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    org_id: str
    role: str
    email: str
    full_name: Optional[str] = None
    plan_tier: Optional[str] = None

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    org_id: Optional[str] = None
    role: Optional[str] = None

class ConsentRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    consent_type: str
    policy_version: str
    granted: bool
    timestamp: datetime
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Minimum 8 characters")
    full_name: str = Field(..., min_length=2)
    organization_name: str = Field(default="Personal Workspace", min_length=2)
    
    # Required consents
    terms_accepted: bool = Field(..., description="Must explicitly agree to Terms and Conditions")
    terms_version: str = Field(default=CURRENT_TERMS_VERSION)
    privacy_accepted: bool = Field(..., description="Must explicitly acknowledge Privacy Policy")
    privacy_version: str = Field(default=CURRENT_PRIVACY_VERSION)
    ai_consent: bool = Field(..., description="Must consent to document AI processing")
    ai_consent_version: str = Field(default=CURRENT_AI_CONSENT_VERSION)
    
    # Optional marketing consent
    marketing_consent: bool = Field(default=False, description="Optional marketing communications")

    @field_validator("terms_accepted")
    @classmethod
    def validate_terms(cls, v: bool) -> bool:
        if not v:
            raise ValueError("You must explicitly accept the Terms and Conditions to register.")
        return v

    @field_validator("privacy_accepted")
    @classmethod
    def validate_privacy(cls, v: bool) -> bool:
        if not v:
            raise ValueError("You must explicitly acknowledge the Privacy Policy to register.")
        return v

    @field_validator("ai_consent")
    @classmethod
    def validate_ai_consent(cls, v: bool) -> bool:
        if not v:
            raise ValueError("You must consent to document AI processing to use OmniDoc Studio.")
        return v

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ConsentWithdrawRequest(BaseModel):
    consent_type: str = Field(..., description="Type of consent to withdraw (e.g., 'marketing_communication')")

class ConsentGrantRequest(BaseModel):
    terms_accepted: bool = Field(True, description="Explicit agreement to Terms of Service")
    terms_version: str = Field(default=CURRENT_TERMS_VERSION)
    privacy_accepted: bool = Field(True, description="Explicit acknowledgement of Privacy Policy")
    privacy_version: str = Field(default=CURRENT_PRIVACY_VERSION)
    ai_consent: bool = Field(False, description="Consent for AI document processing")
    ai_consent_version: str = Field(default=CURRENT_AI_CONSENT_VERSION)
    marketing_consent: bool = Field(False, description="Optional marketing communications")

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    full_name: str
    role: str
    org_id: str
    is_active: bool
    terms_accepted: bool
    privacy_accepted: bool
    ai_consent: bool
    marketing_consent: bool
    created_at: datetime
    consent_records: Optional[List[ConsentRecordOut]] = None
