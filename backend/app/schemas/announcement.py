from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, Field

AnnouncementPriority = Literal["informational", "important", "critical"]
AnnouncementAudience = Literal["all", "plan", "role", "user"]

class AnnouncementCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Announcement headline")
    body: str = Field(..., min_length=1, max_length=20000, description="Announcement body (markdown supported)")
    priority: AnnouncementPriority = Field(default="informational")
    audience_type: AnnouncementAudience = Field(default="all")
    audience_reference: Optional[str] = Field(None, max_length=128, description="Target plan slug, role name, or user ID")
    published_at: Optional[datetime] = Field(None, description="Optional scheduled publication date")
    expires_at: Optional[datetime] = Field(None, description="Optional automatic expiration date")
    is_published: bool = Field(default=True, description="Publish immediately upon creation")

class AnnouncementUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    body: Optional[str] = Field(None, min_length=1, max_length=20000)
    priority: Optional[AnnouncementPriority] = None
    audience_type: Optional[AnnouncementAudience] = None
    audience_reference: Optional[str] = Field(None, max_length=128)
    published_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    is_published: Optional[bool] = None
    is_archived: Optional[bool] = None

class AnnouncementOut(BaseModel):
    id: str
    title: str
    body: str
    priority: str
    audience_type: str
    audience_reference: Optional[str] = None
    created_by: Optional[str] = None
    creator_name: Optional[str] = None
    created_at: datetime
    published_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    is_published: bool
    is_archived: bool
    is_read: Optional[bool] = False
    is_dismissed: Optional[bool] = False
    read_count: Optional[int] = 0

    class Config:
        from_attributes = True

class AnnouncementListResponse(BaseModel):
    items: List[AnnouncementOut]
    total: int
