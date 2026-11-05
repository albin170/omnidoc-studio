from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.schemas.digital_twin import DocumentDigitalTwin

class DocumentOut(BaseModel):
    id: str
    org_id: str
    user_id: Optional[str]
    filename: str
    file_size: int
    mime_type: str
    format_type: str
    content_hash_sha256: str
    version: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class DocumentDetailOut(DocumentOut):
    digital_twin: Optional[DocumentDigitalTwin] = None

