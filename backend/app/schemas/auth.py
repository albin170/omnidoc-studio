from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    org_id: str
    role: str
    email: str

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    org_id: Optional[str] = None
    role: Optional[str] = None

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Minimum 8 characters")
    full_name: str = Field(..., min_length=2)
    organization_name: str = Field(..., min_length=2)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    org_id: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
