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

@pytest.mark.asyncio
async def test_password_change_invalidates_prior_sessions(client: AsyncClient, db_session: AsyncSession):
    from app.core.security import get_password_hash
    from app.models.organization import Organization
    import uuid

    org = Organization(name="Token Revoke Org", slug=f"tr-org-{uuid.uuid4().hex[:6]}", plan_tier="free")
    db_session.add(org)
    await db_session.flush()

    user = User(
        email="token.invalidation@test.com",
        hashed_password=get_password_hash("OldPassword123!"),
        full_name="Token Test User",
        role="user",
        org_id=org.id,
        is_active=True,
        terms_accepted=True,
        privacy_accepted=True,
        ai_consent=True
    )
    db_session.add(user)
    await db_session.commit()

    # Session 1 login
    res1 = await client.post("/api/v1/auth/login", json={"email": user.email, "password": "OldPassword123!"})
    token1 = res1.json()["access_token"]

    # Session 2 login
    res2 = await client.post("/api/v1/auth/login", json={"email": user.email, "password": "OldPassword123!"})
    token2 = res2.json()["access_token"]

    # Verify both work
    me1 = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token1}"})
    assert me1.status_code == 200

    # User changes password via /users/me/change-password using token1
    change_res = await client.post(
        "/api/v1/users/me/change-password",
        headers={"Authorization": f"Bearer {token1}"},
        json={"current_password": "OldPassword123!", "new_password": "NewSecurePassword456!"}
    )
    assert change_res.status_code == 200
    token_fresh = change_res.json()["access_token"]

    # Token 2 (other concurrent session) MUST fail with 401 (session invalidated via token_version)
    me2 = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token2}"})
    assert me2.status_code == 401
    assert "invalidated" in me2.json()["detail"].lower() or "revoked" in me2.json()["detail"].lower()

    # Prior Token 1 also now fails because its token_version is older
    me1_old = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token1}"})
    assert me1_old.status_code == 401

    # Fresh token works
    me_fresh = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token_fresh}"})
    assert me_fresh.status_code == 200


@pytest.mark.asyncio
async def test_billing_cancellation_authorization_enforces_billing_owner(client: AsyncClient, db_session: AsyncSession):
    from app.core.security import get_password_hash
    from app.models.organization import Organization
    import uuid

    org = Organization(name="Billing Auth Org", slug=f"bo-org-{uuid.uuid4().hex[:6]}", plan_tier="free")
    db_session.add(org)
    await db_session.flush()

    # Owner user (created first)
    owner = User(
        email="billing.owner@test.com",
        hashed_password=get_password_hash("OwnerPass123!"),
        full_name="Billing Owner",
        role="user",
        org_id=org.id,
        is_active=True,
        terms_accepted=True,
        privacy_accepted=True,
        ai_consent=True
    )
    db_session.add(owner)
    await db_session.commit()

    # Member user (created second)
    member = User(
        email="billing.member@test.com",
        hashed_password=get_password_hash("MemberPass123!"),
        full_name="Regular Member",
        role="user",
        org_id=org.id,
        is_active=True,
        terms_accepted=True,
        privacy_accepted=True,
        ai_consent=True
    )
    db_session.add(member)
    await db_session.commit()

    # Login both
    res_m = await client.post("/api/v1/auth/login", json={"email": member.email, "password": "MemberPass123!"})
    token_member = res_m.json()["access_token"]
    res_o = await client.post("/api/v1/auth/login", json={"email": owner.email, "password": "OwnerPass123!"})
    token_owner = res_o.json()["access_token"]

    # 1. Non-owner member attempts checkout -> 403 Forbidden
    res_checkout_m = await client.post(
        "/api/v1/billing/checkout",
        headers={"Authorization": f"Bearer {token_member}"},
        json={"plan_slug": "pro", "billing_interval": "monthly"}
    )
    assert res_checkout_m.status_code == 403
    assert "billing owner" in res_checkout_m.json()["detail"].lower()

    # 2. Non-owner member attempts cancellation -> 403 Forbidden
    res_cancel_m = await client.post(
        "/api/v1/billing/cancel",
        headers={"Authorization": f"Bearer {token_member}"},
        json={"reason": "Attacker trying to cancel"}
    )
    assert res_cancel_m.status_code == 403

    # 3. Billing owner attempts checkout -> passes owner auth check (returns 503 gateway unconfigured, NOT 403)
    res_checkout_o = await client.post(
        "/api/v1/billing/checkout",
        headers={"Authorization": f"Bearer {token_owner}"},
        json={"plan_slug": "pro", "billing_interval": "monthly"}
    )
    assert res_checkout_o.status_code == 503

    # 4. Billing owner with malicious external redirect URL -> 400 Bad Request
    res_evil_redirect = await client.post(
        "/api/v1/billing/checkout",
        headers={"Authorization": f"Bearer {token_owner}"},
        json={
            "plan_slug": "pro",
            "billing_interval": "monthly",
            "success_url": "https://malicious-phishing-site.example/steal"
        }
    )
    assert res_evil_redirect.status_code == 400
    assert "unauthorized external origin" in res_evil_redirect.json()["detail"].lower()


@pytest.mark.asyncio
async def test_native_docx_and_pptx_parsing():
    import io
    import zipfile
    from app.services.parser import DocumentParserService

    # Construct minimal valid DOCX package in memory
    docx_buf = io.BytesIO()
    with zipfile.ZipFile(docx_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
        doc_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
            <w:body>
                <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Architecture Overview</w:t></w:r></w:p>
                <w:p><w:r><w:t>This is a confidential architecture document.</w:t></w:r></w:p>
                <w:tbl>
                    <w:tr>
                        <w:tc><w:p><w:r><w:t>Service</w:t></w:r></w:p></w:tc>
                        <w:tc><w:p><w:r><w:t>Status</w:t></w:r></w:p></w:tc>
                    </w:tr>
                    <w:tr>
                        <w:tc><w:p><w:r><w:t>Vault</w:t></w:r></w:p></w:tc>
                        <w:tc><w:p><w:r><w:t>Healthy</w:t></w:r></w:p></w:tc>
                    </w:tr>
                </w:tbl>
            </w:body>
        </w:document>"""
        zf.writestr("word/document.xml", doc_xml)

    docx_bytes = docx_buf.getvalue()
    twin_docx = DocumentParserService.parse_document(
        document_id="doc-docx-1",
        filename="architecture.docx",
        content=docx_bytes,
        format_type="docx"
    )
    assert any("Architecture Overview" in h.text for h in twin_docx.headings)
    assert any("confidential architecture document" in p.text for p in twin_docx.paragraphs)
    assert len(twin_docx.tables) >= 1
    assert twin_docx.tables[0].row_count == 2

    # Construct minimal valid PPTX package in memory
    pptx_buf = io.BytesIO()
    with zipfile.ZipFile(pptx_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
        slide_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <p:cSld>
                <p:spTree>
                    <p:sp>
                        <p:txBody>
                            <a:p><a:r><a:t>OmniDoc Keynote 2026</a:t></a:r></a:p>
                            <a:p><a:r><a:t>Enterprise Autonomous Document Intelligence</a:t></a:r></a:p>
                        </p:txBody>
                    </p:sp>
                </p:spTree>
            </p:cSld>
        </p:sld>"""
        zf.writestr("ppt/slides/slide1.xml", slide_xml)

    pptx_bytes = pptx_buf.getvalue()
    twin_pptx = DocumentParserService.parse_document(
        document_id="doc-pptx-1",
        filename="presentation.pptx",
        content=pptx_bytes,
        format_type="pptx"
    )
    assert twin_pptx.metadata.page_count == 1
    assert any("OmniDoc Keynote 2026" in p.text for p in twin_pptx.paragraphs)


@pytest.mark.asyncio
async def test_stripe_webhook_verified_processing_and_idempotency(client: AsyncClient, db_session: AsyncSession, monkeypatch):
    import time
    import hmac
    import hashlib
    import json
    from app.core.config import settings
    from app.models.organization import Organization
    from app.models.workflow import IdempotencyRecordModel
    from app.services.billing_service import billing_service

    test_webhook_secret = "whsec_test_secret_key_12345"
    monkeypatch.setattr(settings, "STRIPE_WEBHOOK_SECRET", test_webhook_secret)
    monkeypatch.setattr(billing_service, "webhook_secret", test_webhook_secret)

    org = Organization(name="Stripe Webhook Org", slug="stripe-wh-org", plan_tier="free")
    db_session.add(org)
    await db_session.commit()

    event_id = f"evt_test_{int(time.time())}"
    event_payload = {
        "id": event_id,
        "type": "customer.subscription.updated",
        "data": {
            "object": {
                "id": "sub_test_12345",
                "metadata": {
                    "org_id": org.id,
                    "plan_slug": "pro",
                    "billing_interval": "monthly"
                },
                "current_period_start": int(time.time()),
                "current_period_end": int(time.time()) + 30 * 86400
            }
        }
    }
    payload_bytes = json.dumps(event_payload).encode("utf-8")
    ts = str(int(time.time()))
    signed_payload = f"{ts}.".encode("utf-8") + payload_bytes
    sig = hmac.new(test_webhook_secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
    sig_header = f"t={ts},v1={sig}"

    # 1. First webhook delivery succeeds and records idempotency
    res1 = await client.post(
        "/api/v1/billing/webhook",
        content=payload_bytes,
        headers={"Stripe-Signature": sig_header, "Content-Type": "application/json"}
    )
    assert res1.status_code == 200
    assert res1.json()["status"] == "success"

    # Verify idempotency record in database
    rec = await db_session.get(IdempotencyRecordModel, f"stripe_{event_id}")
    assert rec is not None
    assert "processed" in rec.result_json

    # 2. Duplicate webhook delivery returns idempotent skip without failing
    res2 = await client.post(
        "/api/v1/billing/webhook",
        content=payload_bytes,
        headers={"Stripe-Signature": sig_header, "Content-Type": "application/json"}
    )
    assert res2.status_code == 200
    assert res2.json()["status"] == "idempotent_skip"


@pytest.mark.asyncio
async def test_token_without_token_version_claim_rejected_on_versioned_user(client: AsyncClient, db_session: AsyncSession):
    import time
    from app.core.security import get_password_hash
    from app.models.organization import Organization
    from jose import jwt
    from app.core.config import settings
    import uuid

    org = Organization(name="No Version Org", slug=f"nv-org-{uuid.uuid4().hex[:6]}", plan_tier="free")
    db_session.add(org)
    await db_session.flush()

    user = User(
        email="no.token.version@test.com",
        hashed_password=get_password_hash("Password123!"),
        full_name="Versioned User",
        role="user",
        org_id=org.id,
        is_active=True,
        token_version=2
    )
    db_session.add(user)
    await db_session.commit()

    # Craft a JWT without token_version claim
    legacy_payload = {
        "sub": user.id,
        "org_id": user.org_id,
        "role": user.role,
        "exp": int(time.time()) + 3600
    }
    legacy_token = jwt.encode(legacy_payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    # Calling /api/v1/users/me with legacy token MUST be rejected with 401
    res = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {legacy_token}"})
    assert res.status_code == 401
    assert "invalidated" in res.json()["detail"].lower() or "revoked" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_admin_view_as_user_with_incremented_token_version(client: AsyncClient, db_session: AsyncSession):
    from app.core.security import get_password_hash, create_access_token
    from app.models.organization import Organization
    import uuid

    org = Organization(name="Impersonate Org", slug=f"imp-org-{uuid.uuid4().hex[:6]}", plan_tier="free")
    db_session.add(org)
    await db_session.flush()

    admin = User(
        email="super.imp@test.com",
        hashed_password=get_password_hash("AdminPass123!"),
        full_name="Super Impersonator",
        role="superadmin",
        org_id=org.id,
        is_active=True
    )
    target = User(
        email="target.ver2@test.com",
        hashed_password=get_password_hash("TargetPass123!"),
        full_name="Target Ver 2",
        role="user",
        org_id=org.id,
        is_active=True,
        token_version=5
    )
    db_session.add_all([admin, target])
    await db_session.commit()

    admin_token = create_access_token({"sub": admin.id, "email": admin.email, "role": "superadmin"})

    start_res = await client.post(
        "/api/v1/admin/view-sessions",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"target_user_id": target.id, "duration_minutes": 30, "reason": "Debugging customer issue"}
    )
    assert start_res.status_code == 200
    scoped_jwt = start_res.json()["scoped_token"]

    view_res = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {scoped_jwt}"})
    assert view_res.status_code == 200
    assert view_res.json()["email"] == target.email


@pytest.mark.asyncio
async def test_forgot_password_fails_closed_in_production_when_smtp_fails(client: AsyncClient, db_session: AsyncSession, monkeypatch):
    from app.core.config import settings
    from app.core.security import get_password_hash
    from app.models.organization import Organization
    from app.services.email_service import email_service
    import uuid

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")

    # Mock Redis rate limiter for production mode
    class DummyRedisPipeline:
        def zremrangebyscore(self, *a, **kw): return self
        def zcard(self, *a, **kw): return self
        def zadd(self, *a, **kw): return self
        def expire(self, *a, **kw): return self
        async def execute(self): return [0, 1, True, True]

    class DummyRedis:
        def pipeline(self): return DummyRedisPipeline()

    monkeypatch.setattr("app.core.rate_limit._redis_client", DummyRedis())
    monkeypatch.setattr("app.core.rate_limit._get_redis_client", lambda: DummyRedis())

    org = Organization(name="Prod Email Org", slug=f"pe-org-{uuid.uuid4().hex[:6]}", plan_tier="free")
    db_session.add(org)
    await db_session.flush()

    user = User(
        email="prod.user.reset@test.com",
        hashed_password=get_password_hash("Pass123!"),
        full_name="Prod User",
        role="user",
        org_id=org.id,
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()

    async def mock_fail_email(*args, **kwargs):
        return False
    monkeypatch.setattr(email_service, "send_password_reset_email", mock_fail_email)

    res = await client.post("/api/v1/auth/forgot-password", json={"email": user.email})
    assert res.status_code == 503
    assert "email service" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_deterministic_entitlement_overrides_order(db_session: AsyncSession):
    from app.core.security import get_password_hash
    from app.models.organization import Organization
    from app.models.subscription_management import UserEntitlementOverrideModel
    from app.services.entitlement_service import calculate_user_entitlements
    import uuid
    from datetime import datetime, timezone, timedelta

    org = Organization(name="Override Org", slug=f"ov-org-{uuid.uuid4().hex[:6]}", plan_tier="free")
    db_session.add(org)
    await db_session.flush()

    user = User(
        email="override.order@test.com",
        hashed_password=get_password_hash("Pass123!"),
        full_name="Override User",
        role="user",
        org_id=org.id,
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()

    t1 = datetime.now(timezone.utc) - timedelta(minutes=10)
    t2 = datetime.now(timezone.utc)

    ov1 = UserEntitlementOverrideModel(
        user_id=user.id,
        feature_key="pdf_tools",
        custom_storage_quota_bytes=500 * 1024 * 1024,
        created_at=t1
    )
    ov2 = UserEntitlementOverrideModel(
        user_id=user.id,
        feature_key="ocr_engine",
        custom_storage_quota_bytes=1000 * 1024 * 1024,
        created_at=t2
    )
    db_session.add_all([ov1, ov2])
    await db_session.commit()

    entitlements = await calculate_user_entitlements(user, db_session)
    assert entitlements.storage_quota_bytes == 1000 * 1024 * 1024
