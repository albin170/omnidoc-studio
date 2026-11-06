import os
import uuid
from typing import List, Dict, Any, Literal
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.document import Document
from app.models.job import Job
from app.models.audit import AuditEvent

router = APIRouter(prefix="/admin", tags=["Administrator Console"])

ALLOWED_ROLES = {"admin", "staff", "user"}

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required to access this endpoint"
        )
    return current_user

class SystemTelemetryOut(BaseModel):
    status: str
    active_users: int
    total_documents: int
    total_storage_bytes: int
    total_jobs: int
    failed_jobs: int
    environment: str

class UserAdminOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool

class RoleUpdateRequest(BaseModel):
    role: Literal["admin", "staff", "user"]
    is_active: bool

@router.get("/telemetry", response_model=SystemTelemetryOut)
async def get_system_telemetry(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    users_count = await db.scalar(select(func.count(User.id)).where(User.org_id == admin.org_id))
    docs_count = await db.scalar(select(func.count(Document.id)).where(Document.org_id == admin.org_id))
    storage_sum = await db.scalar(select(func.sum(Document.file_size)).where(Document.org_id == admin.org_id)) or 0
    jobs_count = await db.scalar(select(func.count(Job.id)).where(Job.org_id == admin.org_id))
    failed_jobs_count = await db.scalar(select(func.count(Job.id)).where(Job.org_id == admin.org_id, Job.status == "failed"))

    return SystemTelemetryOut(
        status="HEALTHY",
        active_users=users_count or 0,
        total_documents=docs_count or 0,
        total_storage_bytes=storage_sum,
        total_jobs=jobs_count or 0,
        failed_jobs=failed_jobs_count or 0,
        environment=settings.ENVIRONMENT
    )

@router.get("/users", response_model=List[UserAdminOut])
async def list_all_tenant_users(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(User).where(User.org_id == admin.org_id).order_by(User.created_at.desc())
    res = await db.execute(stmt)
    users = res.scalars().all()
    return [
        UserAdminOut(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            role=u.role,
            is_active=u.is_active
        )
        for u in users
    ]

@router.put("/users/{user_id}", response_model=UserAdminOut)
async def update_user_status_and_role(
    user_id: str,
    req: RoleUpdateRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    if user_id == admin.id and req.role != "admin":
        raise HTTPException(status_code=400, detail="Administrators cannot demote their own account")
    
    if req.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role '{req.role}'. Allowed roles: {list(ALLOWED_ROLES)}")

    stmt = select(User).where(User.id == user_id, User.org_id == admin.org_id)
    res = await db.execute(stmt)
    user = res.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found in tenant organization")
    
    prev_role = user.role
    prev_active = user.is_active

    user.role = req.role
    user.is_active = req.is_active

    # Record administrative change in audit trail
    audit_evt = AuditEvent(
        id=str(uuid.uuid4()),
        org_id=admin.org_id,
        user_id=admin.id,
        event_type="ADMIN_ROLE_UPDATED",
        action=f"Changed user {user.email} role from '{prev_role}' to '{req.role}', active state from {prev_active} to {req.is_active}",
        ip_address=None
    )
    db.add(audit_evt)

    await db.commit()
    await db.refresh(user)

    return UserAdminOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active
    )
