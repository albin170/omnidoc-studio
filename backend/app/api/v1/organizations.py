from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.organization import Organization

router = APIRouter(prefix="/organizations", tags=["Organizations"])

class OrganizationOut(BaseModel):
    id: str
    name: str
    slug: str
    plan_tier: str

class MemberOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool

class UpdateOrgRequest(BaseModel):
    name: str

@router.get("/current", response_model=OrganizationOut)
async def get_current_organization(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Organization).where(Organization.id == current_user.org_id)
    res = await db.execute(stmt)
    org = res.scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return OrganizationOut(id=org.id, name=org.name, slug=org.slug, plan_tier=org.plan_tier)

@router.get("/members", response_model=List[MemberOut])
async def list_organization_members(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(User).where(User.org_id == current_user.org_id).order_by(User.created_at.asc())
    res = await db.execute(stmt)
    members = res.scalars().all()
    return [
        MemberOut(
            id=m.id,
            email=m.email,
            full_name=m.full_name,
            role=m.role,
            is_active=m.is_active
        )
        for m in members
    ]

@router.put("/current", response_model=OrganizationOut)
async def update_organization_name(
    req: UpdateOrgRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role not in ("admin", "owner"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only organization administrators can modify organization settings")
    stmt = select(Organization).where(Organization.id == current_user.org_id)
    res = await db.execute(stmt)
    org = res.scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    org.name = req.name.strip()
    await db.commit()
    await db.refresh(org)
    return OrganizationOut(id=org.id, name=org.name, slug=org.slug, plan_tier=org.plan_tier)
