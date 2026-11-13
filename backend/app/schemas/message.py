from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, Field

MessagePriority = Literal["normal", "important", "urgent"]
MessageStatus = Literal["sent", "delivered", "archived"]

class MessageCreateRequest(BaseModel):
    recipient_user_id: str = Field(..., description="ID of the recipient user")
    subject: str = Field(..., min_length=1, max_length=255, description="Message subject")
    body: str = Field(..., min_length=1, max_length=10000, description="Message body content")
    priority: MessagePriority = Field(default="normal", description="Message urgency level")

class MessageReplyRequest(BaseModel):
    body: str = Field(..., min_length=1, max_length=10000, description="Reply body content")

class MessageOut(BaseModel):
    id: str
    sender_user_id: str
    sender_name: Optional[str] = None
    sender_email: Optional[str] = None
    recipient_user_id: str
    recipient_name: Optional[str] = None
    recipient_email: Optional[str] = None
    subject: str
    body: str
    priority: str
    status: str
    created_at: datetime
    read_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class MessageListResponse(BaseModel):
    items: List[MessageOut]
    total: int
    unread_count: int
    page: int
    limit: int
