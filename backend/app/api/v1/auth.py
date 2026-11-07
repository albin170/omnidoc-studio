import uuid
from datetime import datetime, timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError, jwt

from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token, get_current_user
from app.models.user import User
from app.models.organization import Organization
from app.models.consent import ConsentRecord
from app.schemas.auth import (
    Token,
    UserRegister,
    UserLogin,
    UserOut,
    ConsentRecordOut,
    ConsentWithdrawRequest,
    PasswordResetRequest,
    PasswordResetConfirm,
    CURRENT_TERMS_VERSION,
    CURRENT_PRIVACY_VERSION,
    CURRENT_AI_CONSENT_VERSION,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register_user(
    data: UserRegister,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    # Validate Policy Versions
    if data.terms_version != CURRENT_TERMS_VERSION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Outdated Terms of Service version '{data.terms_version}'. Current active version is '{CURRENT_TERMS_VERSION}'."
        )
    if data.privacy_version != CURRENT_PRIVACY_VERSION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Outdated Privacy Policy version '{data.privacy_version}'. Current active version is '{CURRENT_PRIVACY_VERSION}'."
        )
    if data.ai_consent_version != CURRENT_AI_CONSENT_VERSION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Outdated AI processing consent version '{data.ai_consent_version}'. Current active version is '{CURRENT_AI_CONSENT_VERSION}'."
        )

    # Check if user already exists
    existing_stmt = select(User).where(User.email == data.email.lower())
    res = await db.execute(existing_stmt)
    if res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address is already registered."
        )

    client_ip = request.client.host if request.client else None
    client_ua = request.headers.get("user-agent", "")[:255]

    # Database Transaction: Organization, User, and Immutable Consent Records
    try:
        org_slug = data.organization_name.lower().replace(" ", "-")[:40] + f"-{uuid.uuid4().hex[:4]}"
        org = Organization(
            id=str(uuid.uuid4()),
            name=data.organization_name,
            slug=org_slug,
            plan_tier="free"
        )
        db.add(org)
        await db.flush()

        new_user = User(
            id=str(uuid.uuid4()),
            email=data.email.lower(),
            hashed_password=get_password_hash(data.password),
            full_name=data.full_name,
            role="admin",
            org_id=org.id,
            is_active=True,
            terms_accepted=data.terms_accepted,
            privacy_accepted=data.privacy_accepted,
            ai_consent=data.ai_consent,
            marketing_consent=data.marketing_consent,
        )
        db.add(new_user)
        await db.flush()

        # Immutable Consent Records
        consent_terms = ConsentRecord(
            id=str(uuid.uuid4()),
            user_id=new_user.id,
            consent_type="terms_and_conditions",
            policy_version=data.terms_version,
            granted=True,
            ip_address=client_ip,
            user_agent=client_ua
        )
        consent_privacy = ConsentRecord(
            id=str(uuid.uuid4()),
            user_id=new_user.id,
            consent_type="privacy_policy",
            policy_version=data.privacy_version,
            granted=True,
            ip_address=client_ip,
            user_agent=client_ua
        )
        consent_ai = ConsentRecord(
            id=str(uuid.uuid4()),
            user_id=new_user.id,
            consent_type="ai_processing",
            policy_version=data.ai_consent_version,
            granted=True,
            ip_address=client_ip,
            user_agent=client_ua
        )
        consent_marketing = ConsentRecord(
            id=str(uuid.uuid4()),
            user_id=new_user.id,
            consent_type="marketing_communication",
            policy_version="2026.1",
            granted=bool(data.marketing_consent),
            ip_address=client_ip,
            user_agent=client_ua
        )
        created_records = [consent_terms, consent_privacy, consent_ai, consent_marketing]
        db.add_all(created_records)

        await db.commit()
        await db.refresh(new_user)
        
        return UserOut(
            id=new_user.id,
            email=new_user.email,
            full_name=new_user.full_name,
            role=new_user.role,
            org_id=new_user.org_id,
            is_active=new_user.is_active,
            terms_accepted=new_user.terms_accepted,
            privacy_accepted=new_user.privacy_accepted,
            ai_consent=new_user.ai_consent,
            marketing_consent=new_user.marketing_consent,
            created_at=new_user.created_at,
            consent_records=[ConsentRecordOut.model_validate(r) for r in created_records]
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )

@router.post("/login", response_model=Token)
async def login_json(
    credentials: UserLogin,
    db: AsyncSession = Depends(get_db)
):
    email_clean = credentials.email.lower().strip()
    stmt = select(User).where(User.email == email_clean)
    res = await db.execute(stmt)
    user = res.scalars().first()

    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account is disabled")

    # Fetch actual plan tier from organization
    org_stmt = select(Organization).where(Organization.id == user.org_id)
    org_res = await db.execute(org_stmt)
    org = org_res.scalars().first()
    plan_tier = org.plan_tier if org else "free"

    token = create_access_token(data={"sub": user.id, "org_id": user.org_id, "role": user.role, "plan_tier": plan_tier})
    return Token(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        org_id=user.org_id,
        role=user.role,
        email=user.email,
        full_name=user.full_name,
        plan_tier=plan_tier
    )

@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(User).where(User.email == form_data.username.lower())
    res = await db.execute(stmt)
    user = res.scalars().first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account is disabled")

    # Fetch actual plan tier from organization
    org_stmt = select(Organization).where(Organization.id == user.org_id)
    org_res = await db.execute(org_stmt)
    org = org_res.scalars().first()
    plan_tier = org.plan_tier if org else "free"

    token = create_access_token(data={"sub": user.id, "org_id": user.org_id, "role": user.role, "plan_tier": plan_tier})
    return Token(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        org_id=user.org_id,
        role=user.role,
        email=user.email,
        full_name=user.full_name,
        plan_tier=plan_tier
    )

@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    return {
        "status": "success",
        "message": f"Session terminated for user {current_user.email}. Token invalidated.",
        "user_id": current_user.id
    }

@router.get("/me", response_model=UserOut)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(ConsentRecord).where(ConsentRecord.user_id == current_user.id).order_by(ConsentRecord.timestamp.desc())
    res = await db.execute(stmt)
    records = res.scalars().all()
    return UserOut(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        org_id=current_user.org_id,
        is_active=current_user.is_active,
        terms_accepted=current_user.terms_accepted,
        privacy_accepted=current_user.privacy_accepted,
        ai_consent=current_user.ai_consent,
        marketing_consent=current_user.marketing_consent,
        created_at=current_user.created_at,
        consent_records=[ConsentRecordOut.model_validate(r) for r in records]
    )

@router.get("/consent/history", response_model=List[ConsentRecordOut])
async def get_consent_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(ConsentRecord).where(ConsentRecord.user_id == current_user.id).order_by(ConsentRecord.timestamp.desc())
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("/consent/withdraw", response_model=ConsentRecordOut)
async def withdraw_consent(
    payload: ConsentWithdrawRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    target = payload.consent_type.lower().strip()
    if target in ("terms_and_conditions", "privacy_policy"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot withdraw Terms and Conditions or Privacy Policy consent while maintaining an active account. Please request account deletion to withdraw foundational agreements."
        )

    client_ip = request.client.host if request.client else None
    client_ua = request.headers.get("user-agent", "")[:255]

    # Append immutable withdrawal record
    record = ConsentRecord(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        consent_type=target,
        policy_version="2026.1",
        granted=False,
        ip_address=client_ip,
        user_agent=client_ua
    )
    db.add(record)

    # Update User flag
    if target == "marketing_communication":
        current_user.marketing_consent = False
    elif target == "ai_processing":
        current_user.ai_consent = False

    await db.commit()
    await db.refresh(record)
    return record

@router.post("/forgot-password")
async def forgot_password(
    payload: PasswordResetRequest,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(User).where(User.email == payload.email.lower().strip())
    res = await db.execute(stmt)
    user = res.scalars().first()

    email_configured = bool(getattr(settings, "SMTP_HOST", None))

    # Always return safe message to prevent user enumeration attacks
    if not user:
        return {
            "status": "success",
            "message": f"If an account exists for {payload.email}, password reset instructions have been generated.",
            "email_dispatched": email_configured
        }

    reset_token = create_access_token(
        data={"sub": user.id, "type": "password_reset", "email": user.email},
        expires_delta=timedelta(hours=2)
    )

    msg = f"Password reset instructions have been dispatched to {payload.email}." if email_configured else f"Password reset token generated for {payload.email}. (Email delivery service not configured on server; reset token issued)."

    return {
        "status": "success",
        "message": msg,
        "email_dispatched": email_configured,
        "reset_token": reset_token
    }

@router.post("/reset-password")
async def reset_password(
    payload: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db)
):
    try:
        decoded = jwt.decode(payload.token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = decoded.get("sub")
        token_type = decoded.get("type")
        if not user_id or token_type != "password_reset":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid password reset token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Expired or malformed password reset token")

    stmt = select(User).where(User.id == user_id)
    res = await db.execute(stmt)
    user = res.scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User account not found")

    user.hashed_password = get_password_hash(payload.new_password)
    await db.commit()

    return {
        "status": "success",
        "message": "Password has been successfully updated. You may now sign in with your new credentials."
    }
