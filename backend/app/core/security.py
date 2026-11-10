import uuid
import json
import bcrypt
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.models.revocation import RevokedToken
from app.models.subscription_management import AdminViewSessionModel
from app.models.audit import AuditEvent

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/token")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if "jti" not in to_encode:
        to_encode["jti"] = str(uuid.uuid4())
    if "token_version" not in to_encode:
        to_encode["token_version"] = 1
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

async def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        jti: Optional[str] = payload.get("jti")
        is_admin_view: bool = bool(payload.get("is_admin_view", False))
        view_session_id: Optional[str] = payload.get("view_session_id") or payload.get("view_session_token")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Enforce active token revocation / session invalidation
    if jti:
        revoked = await db.scalar(select(RevokedToken).where(RevokedToken.token_jti == jti))
        if revoked:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication token has been revoked",
                headers={"WWW-Authenticate": "Bearer"},
            )

    # Validate Impersonation / View-As-User Session against database on every request (Phase 2.1)
    view_session = None
    if is_admin_view:
        if not view_session_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Impersonation token missing session identifier",
                headers={"WWW-Authenticate": "Bearer"},
            )
        stmt_sess = select(AdminViewSessionModel).where(
            or_(
                AdminViewSessionModel.id == view_session_id,
                AdminViewSessionModel.session_token == view_session_id
            )
        )
        res_sess = await db.execute(stmt_sess)
        view_session = res_sess.scalars().first()

        if not view_session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or nonexistent impersonation session",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if view_session.ended_at is not None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Impersonation session has been terminated",
                headers={"WWW-Authenticate": "Bearer"},
            )

        now = datetime.now(timezone.utc)
        exp = view_session.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < now:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Impersonation session has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Enforce read-only access centrally: Prohibit any mutations during impersonation
        if request.method in ("POST", "PUT", "PATCH", "DELETE"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Impersonated sessions are strictly read-only. Mutation operations are prohibited."
            )

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalars().first()

    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive or suspended user account")

    # Enforce server-controlled token version invalidation (Section 2.B)
    expected_token_ver = getattr(user, "token_version", 1)
    token_ver = payload.get("token_version")
    if token_ver != expected_token_ver:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session invalidated by recent password change or security revocation. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # If impersonated, bind session identity and strictly demote role so target privilege cannot escalate
    if is_admin_view and view_session:
        user.is_impersonated = True
        user.impersonation_session_id = view_session.id
        user.impersonating_admin_id = view_session.admin_id
        # Never allow impersonated user to retain or gain admin/superadmin privileges
        user.role = "user"

        # Record immutable audit event for impersonated access (Phase 2.1 Rule 13)
        client_host = request.client.host if request.client else None
        forwarded = request.headers.get("x-forwarded-for")
        cf_ip = request.headers.get("cf-connecting-ip")
        is_trusted_proxy = settings.TRUST_PROXY_HEADERS or (client_host and client_host in settings.TRUSTED_PROXIES)
        if is_trusted_proxy and forwarded:
            client_ip = forwarded.split(",")[0].strip()
        elif is_trusted_proxy and cf_ip:
            client_ip = cf_ip.strip()
        elif client_host:
            client_ip = client_host
        else:
            client_ip = None
        access_audit = AuditEvent(
            id=str(uuid.uuid4()),
            org_id=user.org_id,
            user_id=view_session.admin_id,
            action="ADMIN_VIEW_AS_USER_ACCESS",
            target_type="user",
            target_id=user.id,
            ip_address=client_ip,
            details_json=json.dumps({"method": request.method, "path": request.url.path, "view_session_id": str(view_session.id)}),
            timestamp=datetime.now(timezone.utc).replace(tzinfo=None)
        )
        db.add(access_audit)
    else:
        user.is_impersonated = False

    return user

def require_roles(allowed_roles: List[str]):
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if getattr(current_user, "is_impersonated", False):
            if any(r in ("admin", "superadmin") for r in allowed_roles):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Impersonated sessions are prohibited from accessing administrative endpoints"
                )
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation requires one of the following roles: {allowed_roles}"
            )
        return current_user
    return role_checker
