from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.audit import AuditEvent

router = APIRouter(prefix="/audit", tags=["Audit & Traceability"])

class AuditEventOut(BaseModel):
    id: str
    org_id: str
    user_id: Optional[str]
    action: str
    target_type: str
    target_id: str
    ip_address: Optional[str]
    details_json: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True

@router.get("/events", response_model=List[AuditEventOut])
async def list_audit_events(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(AuditEvent).where(AuditEvent.org_id == current_user.org_id).order_by(AuditEvent.timestamp.desc()).limit(limit)
    res = await db.execute(stmt)
    return res.scalars().all()
