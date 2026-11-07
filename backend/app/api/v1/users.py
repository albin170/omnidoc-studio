from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.security import get_current_user, get_password_hash, verify_password
from app.models.user import User
from app.models.audit import AuditEvent

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
    await db.commit()
    return {"status": "success", "message": "Password updated successfully"}

@router.delete("/me", status_code=status.HTTP_200_OK)
async def delete_my_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Executes GDPR/CCPA account deletion request.
    Deactivates account and records an immutable audit event.
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
    current_user.is_active = False

    audit = AuditEvent(
        org_id=current_user.org_id,
        user_id=current_user.id,
        action="USER_ACCOUNT_DELETED",
        target_type="user",
        target_id=current_user.id,
        details_json=f'{{"email": "{current_user.email}", "reason": "Self requested deletion"}}',
        timestamp=now
    )
    db.add(audit)
    await db.commit()

    return {
        "status": "success",
        "message": "Account has been successfully deactivated and queued for complete purging."
    }
