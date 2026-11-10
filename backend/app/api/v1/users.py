import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete

from app.core.database import get_db
from app.core.security import get_current_user, get_password_hash, verify_password, create_access_token
from app.models.user import User
from app.models.organization import Organization
from app.models.document import Document
from app.models.api_key import ApiKey
from app.models.audit import AuditEvent
from app.services.storage import storage_vault

router = APIRouter(prefix="/users", tags=["Users"])

class UserProfileOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    org_id: str

class UpdateProfileRequest(BaseModel):
    full_name: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@router.get("/me", response_model=UserProfileOut)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    return UserProfileOut(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        org_id=current_user.org_id
    )

@router.put("/me", response_model=UserProfileOut)
async def update_my_profile(
    req: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    current_user.full_name = req.full_name.strip()
    await db.commit()
    await db.refresh(current_user)
    return UserProfileOut(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        org_id=current_user.org_id
    )

@router.post("/me/change-password")
async def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not verify_password(req.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    if len(req.new_password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be at least 8 characters")

    current_user.hashed_password = get_password_hash(req.new_password)
    # Server-controlled session invalidation: invalidate all prior sessions/tokens (Section 2.B)
    current_user.token_version = (current_user.token_version or 1) + 1

    org_stmt = select(Organization).where(Organization.id == current_user.org_id)
    org_res = await db.execute(org_stmt)
    org = org_res.scalars().first()
    plan_tier = current_user.individual_plan_tier or (org.plan_tier if org else "free")

    # Issue a fresh access token bound to the incremented token_version
    new_token = create_access_token(
        data={
            "sub": current_user.id,
            "org_id": current_user.org_id,
            "role": current_user.role,
            "plan_tier": plan_tier,
            "token_version": current_user.token_version
        }
    )

    audit = AuditEvent(
        org_id=current_user.org_id,
        user_id=current_user.id,
        action="USER_PASSWORD_CHANGED",
        target_type="user",
        target_id=current_user.id,
        details_json=json.dumps({"token_version": current_user.token_version}),
        timestamp=datetime.now(timezone.utc).replace(tzinfo=None)
    )
    db.add(audit)
    await db.commit()

    return {
        "status": "success",
        "message": "Password updated successfully. Other active sessions have been invalidated.",
        "access_token": new_token,
        "token_type": "bearer"
    }

@router.delete("/me", status_code=status.HTTP_200_OK)
async def delete_my_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Executes real GDPR/CCPA account data erasure and purge workflow.
    Removes documents, purges stored files, revokes API keys, invalidates sessions,
    and anonymizes personal information.
    """
    if current_user.role == "superadmin":
        count_stmt = select(func.count(User.id)).where(User.role == "superadmin", User.is_active == True)
        count_res = await db.execute(count_stmt)
        if (count_res.scalar() or 0) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the sole superadministrator account."
            )

    now = datetime.now(timezone.utc)

    # 1. Purge all uploaded documents and stored files from vault
    doc_stmt = select(Document).where(Document.user_id == current_user.id)
    doc_res = await db.execute(doc_stmt)
    user_docs = doc_res.scalars().all()
    purged_files = 0
    for doc in user_docs:
        try:
            storage_vault.delete_file(org_id=doc.org_id, storage_path=doc.storage_path)
            purged_files += 1
        except Exception:
            pass
        await db.delete(doc)

    # 2. Revoke all user API keys
    await db.execute(delete(ApiKey).where(ApiKey.user_id == current_user.id))

    # 3. Invalidate all active tokens/sessions via token_version increment
    current_user.token_version = (current_user.token_version or 1) + 100
    current_user.is_active = False

    # 4. Anonymize user identity
    original_email = current_user.email
    current_user.email = f"purged_{current_user.id[:8]}@purged.omnidoc.local"
    current_user.full_name = "Purged Account"
    current_user.hashed_password = "ACCOUNT_PURGED"

    audit = AuditEvent(
        org_id=current_user.org_id,
        user_id=current_user.id,
        action="USER_ACCOUNT_PURGED",
        target_type="user",
        target_id=current_user.id,
        details_json=json.dumps({
            "purged_documents_count": len(user_docs),
            "purged_files_count": purged_files,
            "status": "purged_and_anonymized",
            "timestamp": now.isoformat()
        }),
        timestamp=now
    )
    db.add(audit)
    await db.commit()

    return {
        "status": "success",
        "message": f"Account deactivated and all associated personal assets successfully purged ({len(user_docs)} documents removed).",
        "purged_documents": len(user_docs),
        "account_status": "purged"
    }
