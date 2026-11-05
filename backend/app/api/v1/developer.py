import uuid
import secrets
import hashlib
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.api_key import ApiKey

router = APIRouter(prefix="/developer", tags=["Developer Platform"])

class CreateApiKeyRequest(BaseModel):
    name: str
    scopes: Optional[str] = "read:documents,write:conversions,execute:agent"
    rate_limit_rpm: Optional[int] = 60

class ApiKeyCreatedResponse(BaseModel):
    id: str
    name: str
    api_key: str # Returned ONLY upon creation!
    key_prefix: str
    scopes: str
    rate_limit_rpm: int
    created_at: datetime

class ApiKeyListItem(BaseModel):
    id: str
    name: str
    key_prefix: str
    scopes: str
    rate_limit_rpm: int
    is_active: bool
    created_at: datetime
    last_used_at: Optional[datetime]

@router.post("/keys", response_model=ApiKeyCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    req: CreateApiKeyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    raw_token = f"omni_live_{secrets.token_urlsafe(32)}"
    key_prefix = raw_token[:14]
    key_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    new_key = ApiKey(
        org_id=current_user.org_id,
        user_id=current_user.id,
        name=req.name.strip(),
        key_prefix=key_prefix,
        key_hash=key_hash,
        scopes=req.scopes or "read:documents,write:conversions,execute:agent",
        rate_limit_rpm=req.rate_limit_rpm or 60,
        is_active=True
    )
    db.add(new_key)
    await db.commit()
    await db.refresh(new_key)

    return ApiKeyCreatedResponse(
        id=new_key.id,
        name=new_key.name,
        api_key=raw_token,
        key_prefix=new_key.key_prefix,
        scopes=new_key.scopes,
        rate_limit_rpm=new_key.rate_limit_rpm,
        created_at=new_key.created_at
    )

@router.get("/keys", response_model=List[ApiKeyListItem])
async def list_api_keys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(ApiKey).where(ApiKey.org_id == current_user.org_id).order_by(ApiKey.created_at.desc())
    res = await db.execute(stmt)
    keys = res.scalars().all()
    return [
        ApiKeyListItem(
            id=k.id,
            name=k.name,
            key_prefix=k.key_prefix,
            scopes=k.scopes,
            rate_limit_rpm=k.rate_limit_rpm,
            is_active=k.is_active,
            created_at=k.created_at,
            last_used_at=k.last_used_at
        )
        for k in keys
    ]

@router.delete("/keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    key_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(ApiKey).where(ApiKey.id == key_id, ApiKey.org_id == current_user.org_id)
    res = await db.execute(stmt)
    key = res.scalars().first()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    await db.delete(key)
    await db.commit()
    return None
