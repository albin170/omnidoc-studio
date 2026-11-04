import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token, get_current_user
from app.models.user import User
from app.models.organization import Organization
from app.schemas.auth import Token, UserRegister, UserOut

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register_user(
    data: UserRegister,
    db: AsyncSession = Depends(get_db)
):
    # Check if user already exists
    existing_stmt = select(User).where(User.email == data.email.lower())
    res = await db.execute(existing_stmt)
    if res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address is already registered."
        )

    # Create Organization
    org_slug = data.organization_name.lower().replace(" ", "-")[:40] + f"-{uuid.uuid4().hex[:4]}"
    org = Organization(
        id=str(uuid.uuid4()),
        name=data.organization_name,
        slug=org_slug,
        plan_tier="pro"
    )
    db.add(org)
    await db.flush()

    # Create User
    new_user = User(
        id=str(uuid.uuid4()),
        email=data.email.lower(),
        hashed_password=get_password_hash(data.password),
        full_name=data.full_name,
        role="admin", # First user in organization is admin
        org_id=org.id,
        is_active=True
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    return new_user

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

    token = create_access_token(data={"sub": user.id, "org_id": user.org_id, "role": user.role})
    return Token(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        org_id=user.org_id,
        role=user.role,
        email=user.email
    )

@router.get("/me", response_model=UserOut)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user)
):
    return current_user
