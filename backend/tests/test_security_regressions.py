import pytest
from httpx import AsyncClient
from app.schemas.auth import (
    CURRENT_TERMS_VERSION,
    CURRENT_PRIVACY_VERSION,
    CURRENT_AI_CONSENT_VERSION,
)
from app.models.user import User
from app.models.password_reset import PasswordResetToken
from app.core.database import AsyncSessionLocal
from sqlalchemy import select

@pytest.mark.asyncio
async def test_registration_always_assigns_user_role_and_blocks_admin(client: AsyncClient):
    # Public registration with any input must strictly result in role == "user"
    res = await client.post("/api/v1/auth/register", json={
        "email": "customer.role.check@example.com",
        "password": "Password123!Secure",
        "full_name": "Standard Customer",
        "organization_name": "Test Org",
        "terms_accepted": True,
        "terms_version": CURRENT_TERMS_VERSION,
        "privacy_accepted": True,
        "privacy_version": CURRENT_PRIVACY_VERSION,
        "ai_consent": True,
        "ai_consent_version": CURRENT_AI_CONSENT_VERSION,
        "marketing_consent": False
    })
    assert res.status_code == 201
    data = res.json()
    assert data["role"] == "user"

    # Authenticate as this customer
    login_res = await client.post("/api/v1/auth/token", data={
        "username": "customer.role.check@example.com",
        "password": "Password123!Secure"
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    auth_header = {"Authorization": f"Bearer {token}"}

    # Attempt to access administrative endpoints
    endpoints_to_test = [
        "/api/v1/admin/telemetry",
        "/api/v1/admin/users",
        "/api/v1/admin/plans",
        "/api/v1/admin/features",
        "/api/v1/admin/ui-config",
        "/api/v1/admin/audit-logs"
    ]
    for ep in endpoints_to_test:
        forbidden_res = await client.get(ep, headers=auth_header)
        assert forbidden_res.status_code == 403
        assert "Administrative privileges required" in forbidden_res.json()["detail"]

@pytest.mark.asyncio
async def test_password_reset_token_security_and_no_leakage(client: AsyncClient, db_session: AsyncSession):
    # Register account for this test
    reg_res = await client.post("/api/v1/auth/register", json={
        "email": "customer.reset.test@example.com",
        "password": "InitialPassword123!",
        "full_name": "Reset Test User",
        "organization_name": "Reset Org",
        "terms_accepted": True,
        "privacy_accepted": True,
        "ai_consent": True
    })
    assert reg_res.status_code == 201
    user_id = reg_res.json()["id"]

    # 1. Non-existent account returns generic response without revealing account status
    res_nonexistent = await client.post("/api/v1/auth/forgot-password", json={
        "email": "does_not_exist_98234@unknown.com"
    })
    assert res_nonexistent.status_code == 200
    data_nonexistent = res_nonexistent.json()
    assert "reset_token" not in data_nonexistent
    assert "If an account exists for that email address" in data_nonexistent["message"]

    # 2. Existing account returns exact same generic response without reset_token
    res_existing = await client.post("/api/v1/auth/forgot-password", json={
        "email": "customer.reset.test@example.com"
    })
    assert res_existing.status_code == 200
    data_existing = res_existing.json()
    assert "reset_token" not in data_existing
    assert data_existing["message"] == data_nonexistent["message"]

    # 3. Verify token hash was stored in database
    token_record = await db_session.scalar(
        select(PasswordResetToken)
        .where(PasswordResetToken.user_id == user_id, PasswordResetToken.used_at.is_(None))
    )
    assert token_record is not None
    assert len(token_record.token_hash) == 64

    # The raw token was captured in test environment on app state
    from app.main import app
    raw_token = getattr(app.state, f"_last_reset_token_{user_id}", None)
    assert raw_token is not None

    # 4. Use the single-use token to reset the password
    reset_res = await client.post("/api/v1/auth/reset-password", json={
        "token": raw_token,
        "new_password": "NewSecurePassword2026!"
    })
    assert reset_res.status_code == 200
    assert "Password has been successfully updated" in reset_res.json()["message"]

    # 5. Token reuse MUST fail
    reuse_res = await client.post("/api/v1/auth/reset-password", json={
        "token": raw_token,
        "new_password": "AnotherPassword123!"
    })
    assert reuse_res.status_code == 400
    assert "already been used" in reuse_res.json()["detail"]

    # 6. Verify user can log in with new password and cannot with old password
    old_login = await client.post("/api/v1/auth/token", data={
        "username": "customer.reset.test@example.com",
        "password": "InitialPassword123!"
    })
    assert old_login.status_code == 401

    new_login = await client.post("/api/v1/auth/token", data={
        "username": "customer.reset.test@example.com",
        "password": "NewSecurePassword2026!"
    })
    assert new_login.status_code == 200

@pytest.mark.asyncio
async def test_jwt_revocation_and_logout(client: AsyncClient):
    # Register user
    reg_res = await client.post("/api/v1/auth/register", json={
        "email": "customer.logout.test@example.com",
        "password": "ValidPassword123!",
        "full_name": "Logout Test User",
        "organization_name": "Logout Org",
        "terms_accepted": True,
        "privacy_accepted": True,
        "ai_consent": True
    })
    assert reg_res.status_code == 201

    # Log in
    login_res = await client.post("/api/v1/auth/token", data={
        "username": "customer.logout.test@example.com",
        "password": "ValidPassword123!"
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Verify token works
    me_res = await client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200

    # Logout and revoke token
    logout_res = await client.post("/api/v1/auth/logout", headers=headers)
    assert logout_res.status_code == 200
    assert "revoked" in logout_res.json()["message"]

    # Subsequent request using the revoked token MUST fail with 401
    revoked_res = await client.get("/api/v1/auth/me", headers=headers)
    assert revoked_res.status_code == 401
    assert "revoked" in revoked_res.json()["detail"]

@pytest.mark.asyncio
async def test_seeding_is_idempotent_and_does_not_overwrite_passwords(db_session: AsyncSession, monkeypatch):
    from app.services.seed_data import seed_initial_plans_and_features
    from app.core.security import verify_password, get_password_hash

    monkeypatch.setenv("INITIAL_ADMIN_PASSWORD", "SuperSecureInitialAdminPass123!")

    # Run seed
    await seed_initial_plans_and_features(db_session)
    user = await db_session.scalar(select(User).where(User.email == "admin@omnidoc.io"))
    assert user is not None

    # Admin changes their password
    custom_password_hash = get_password_hash("SuperCustomSecretPass999!")
    user.hashed_password = custom_password_hash
    await db_session.commit()

    # Run seed again (simulating subsequent serverless cold start)
    await seed_initial_plans_and_features(db_session)

    # Verify password hash was NOT overwritten
    await db_session.refresh(user)
    assert verify_password("SuperCustomSecretPass999!", user.hashed_password) is True

@pytest.mark.asyncio
async def test_superadmin_authorization_and_ordinary_admin_restriction(client: AsyncClient, db_session: AsyncSession):
    from app.core.security import get_password_hash, create_access_token
    from app.models.organization import Organization
    import uuid

    org = Organization(name="Admin Auth Test Org", slug=f"admin-auth-{uuid.uuid4().hex[:6]}", plan_tier="enterprise")
    db_session.add(org)
    await db_session.flush()

    superadmin = User(
        email="root.super@test.com",
        hashed_password=get_password_hash("SuperPass123!"),
        full_name="Super Admin",
        role="superadmin",
        org_id=org.id,
        is_active=True
    )
    ordinary_admin = User(
        email="ordinary.admin@test.com",
        hashed_password=get_password_hash("OrdinaryPass123!"),
        full_name="Ordinary Admin",
        role="admin",
        org_id=org.id,
        is_active=True
    )
    target_user = User(
        email="target.regular@test.com",
        hashed_password=get_password_hash("TargetPass123!"),
        full_name="Target Regular",
        role="user",
        org_id=org.id,
        is_active=True
    )
    db_session.add_all([superadmin, ordinary_admin, target_user])
    await db_session.commit()

    token_super = create_access_token({"sub": superadmin.id, "email": superadmin.email, "role": "superadmin"})
    token_ordinary = create_access_token({"sub": ordinary_admin.id, "email": ordinary_admin.email, "role": "admin"})

    # 1. Ordinary admin tries to promote target_user to admin -> MUST FAIL 403
    fail_res = await client.patch(
        f"/api/v1/admin/users/{target_user.id}",
        headers={"Authorization": f"Bearer {token_ordinary}"},
        json={"role": "admin"}
    )
    assert fail_res.status_code == 403
    assert "Only superadministrators" in fail_res.json()["detail"]

    # 2. Superadmin promotes target_user to admin -> MUST SUCCEED 200
    success_res = await client.patch(
        f"/api/v1/admin/users/{target_user.id}",
        headers={"Authorization": f"Bearer {token_super}"},
        json={"role": "admin"}
    )
    assert success_res.status_code == 200

@pytest.mark.asyncio
async def test_individual_user_plan_does_not_mutate_organization_plan(client: AsyncClient, db_session: AsyncSession):
    from app.core.security import get_password_hash, create_access_token
    from app.models.organization import Organization
    import uuid

    org = Organization(name="Multi Tenant Plan Org", slug=f"mt-plan-{uuid.uuid4().hex[:6]}", plan_tier="free")
    db_session.add(org)
    await db_session.flush()

    superadmin = User(
        email="plan.super@test.com",
        hashed_password=get_password_hash("Pass123!"),
        full_name="Plan Admin",
        role="superadmin",
        org_id=org.id,
        is_active=True
    )
    user1 = User(
        email="member1@test.com",
        hashed_password=get_password_hash("Pass123!"),
        full_name="Member One",
        role="user",
        org_id=org.id,
        is_active=True
    )
    user2 = User(
        email="member2@test.com",
        hashed_password=get_password_hash("Pass123!"),
        full_name="Member Two",
        role="user",
        org_id=org.id,
        is_active=True
    )
    db_session.add_all([superadmin, user1, user2])
    await db_session.commit()

    token_super = create_access_token({"sub": superadmin.id, "email": superadmin.email, "role": "superadmin"})

    # Update Member 1's plan to "pro"
    update_res = await client.patch(
        f"/api/v1/admin/users/{user1.id}",
        headers={"Authorization": f"Bearer {token_super}"},
        json={"plan_tier": "pro"}
    )
    assert update_res.status_code == 200

    # Verify Member 1 has individual plan "pro"
    detail1 = await client.get(f"/api/v1/admin/users/{user1.id}", headers={"Authorization": f"Bearer {token_super}"})
    assert detail1.status_code == 200
    assert detail1.json()["plan_tier"] == "pro"
    assert detail1.json()["individual_plan_tier"] == "pro"

    # Verify Member 2 STILL has organization plan "free" and was NOT changed
    detail2 = await client.get(f"/api/v1/admin/users/{user2.id}", headers={"Authorization": f"Bearer {token_super}"})
    assert detail2.status_code == 200
    assert detail2.json()["plan_tier"] == "free"
    assert detail2.json()["individual_plan_tier"] is None

    # Verify Organization plan_tier is STILL "free"
    await db_session.refresh(org)
    assert org.plan_tier == "free"

    # Now explicitly update organization subscription to "starter"
    org_res = await client.patch(
        f"/api/v1/admin/organizations/{org.id}/subscription",
        headers={"Authorization": f"Bearer {token_super}"},
        json={"plan_tier": "starter"}
    )
    assert org_res.status_code == 200

    # Member 2 now inherits "starter", while Member 1 retains individual override "pro"
    detail2_updated = await client.get(f"/api/v1/admin/users/{user2.id}", headers={"Authorization": f"Bearer {token_super}"})
    assert detail2_updated.json()["plan_tier"] == "starter"

    detail1_recheck = await client.get(f"/api/v1/admin/users/{user1.id}", headers={"Authorization": f"Bearer {token_super}"})
    assert detail1_recheck.json()["plan_tier"] == "pro"

@pytest.mark.asyncio
async def test_rate_limiting_triggers_429(client: AsyncClient):
    from app.core.rate_limit import clear_rate_limits
    clear_rate_limits()

    # Rate limit for forgot-password is 10 requests per 15 min
    status_codes = []
    for _ in range(12):
        res = await client.post("/api/v1/auth/forgot-password", json={"email": "ratelimit.test@example.com"})
        status_codes.append(res.status_code)

    assert 429 in status_codes
    clear_rate_limits()
