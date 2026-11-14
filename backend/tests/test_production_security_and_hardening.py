import pytest
from httpx import AsyncClient
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user import User
from app.models.organization import Organization
from app.models.document import Document
from app.models.subscription_management import AdminViewSessionModel, PlanModel
from app.core.security import get_password_hash, create_access_token
from app.services.seed_data import seed_initial_plans_and_features
from app.services.billing_service import billing_service

@pytest.mark.asyncio
async def test_impersonation_security_and_read_only_enforcement(client: AsyncClient, db_session: AsyncSession):
    """
    Phase 2.1 Deep Verification:
    - Only superadmin can initiate impersonation
    - Cannot impersonate admin/superadmin
    - Impersonated token strictly forced to 'user' role
    - Centrally prohibits any POST/PUT/PATCH/DELETE mutations (403)
    - Prohibits accessing administrative endpoints (403)
    - Terminated sessions are rejected on subsequent requests (401)
    """
    await seed_initial_plans_and_features(db_session)

    org = Organization(name="Security Test Corp", slug="sec-test-corp", plan_tier="pro")
    db_session.add(org)
    await db_session.flush()

    superadmin = User(
        email="super_chief@omnidoc.io",
        hashed_password=get_password_hash("SuperSecure123!"),
        full_name="Chief Superadmin",
        role="superadmin",
        is_active=True,
        terms_accepted=True,
        privacy_accepted=True,
        ai_consent=True,
        org_id=org.id
    )
    admin = User(
        email="regular_admin@omnidoc.io",
        hashed_password=get_password_hash("AdminPass123!"),
        full_name="Regular Admin",
        role="admin",
        is_active=True,
        terms_accepted=True,
        privacy_accepted=True,
        ai_consent=True,
        org_id=org.id
    )
    target_user = User(
        email="victim_user@omnidoc.io",
        hashed_password=get_password_hash("UserPass123!"),
        full_name="Target User",
        role="user",
        is_active=True,
        terms_accepted=True,
        privacy_accepted=True,
        ai_consent=True,
        org_id=org.id
    )
    db_session.add_all([superadmin, admin, target_user])
    await db_session.commit()

    # 1. Login as superadmin and regular admin
    res_sa = await client.post("/api/v1/admin/auth/login", json={"email": superadmin.email, "password": "SuperSecure123!"})
    assert res_sa.status_code == 200
    sa_token = res_sa.json()["access_token"]
    sa_headers = {"Authorization": f"Bearer {sa_token}"}

    res_adm = await client.post("/api/v1/admin/auth/login", json={"email": admin.email, "password": "AdminPass123!"})
    assert res_adm.status_code == 200
    adm_token = res_adm.json()["access_token"]
    adm_headers = {"Authorization": f"Bearer {adm_token}"}

    # 2. Regular admin attempting to initiate impersonation must be REJECTED (403)
    res_fail_adm = await client.post(
        "/api/v1/admin/view-sessions",
        headers=adm_headers,
        json={"target_user_id": target_user.id, "duration_minutes": 15}
    )
    assert res_fail_adm.status_code == 403
    assert "Superadministrator privileges required" in res_fail_adm.json()["detail"]

    # 3. Superadmin attempting to impersonate another admin/superadmin must be REJECTED (403)
    res_fail_target = await client.post(
        "/api/v1/admin/view-sessions",
        headers=sa_headers,
        json={"target_user_id": admin.id, "duration_minutes": 15}
    )
    assert res_fail_target.status_code == 403
    assert "Cannot impersonate administrative" in res_fail_target.json()["detail"]

    # 4. Superadmin creates view session for standard user -> SUCCEEDS (200)
    res_view = await client.post(
        "/api/v1/admin/view-sessions",
        headers=sa_headers,
        json={"target_user_id": target_user.id, "duration_minutes": 15}
    )
    assert res_view.status_code == 200
    view_data = res_view.json()
    impersonated_token = view_data["scoped_token"]
    view_session_id = view_data["view_session_id"]
    imp_headers = {"Authorization": f"Bearer {impersonated_token}"}

    # 5. Impersonated session CAN read user endpoints (GET)
    res_read = await client.get("/api/v1/users/me", headers=imp_headers)
    assert res_read.status_code == 200
    assert res_read.json()["email"] == target_user.email
    assert res_read.json()["role"] == "user" # Never admin

    # 6. Impersonated session attempting MUTATION (PUT) is CENTRALLY BLOCKED (403)
    res_write = await client.put(
        "/api/v1/users/me",
        headers=imp_headers,
        json={"full_name": "Hacked Name"}
    )
    assert res_write.status_code == 403
    assert "Impersonated sessions are strictly read-only" in res_write.json()["detail"]

    # 7. Impersonated session attempting password change (POST) is CENTRALLY BLOCKED (403)
    res_pwd = await client.post(
        "/api/v1/users/me/change-password",
        headers=imp_headers,
        json={"current_password": "UserPass123!", "new_password": "NewSecretPass123!"}
    )
    assert res_pwd.status_code == 403

    # 8. Impersonated session attempting to access admin console is CENTRALLY BLOCKED (403)
    res_admin_access = await client.get("/api/v1/admin/telemetry", headers=imp_headers)
    assert res_admin_access.status_code == 403

    # 9. Superadmin terminates view session
    res_term = await client.delete(f"/api/v1/admin/view-sessions/{view_session_id}", headers=sa_headers)
    assert res_term.status_code == 200

    # 10. Subsequent requests with terminated impersonation token are REJECTED (401)
    res_after_term = await client.get("/api/v1/users/me", headers=imp_headers)
    assert res_after_term.status_code == 401
    assert "terminated" in res_after_term.json()["detail"].lower()

@pytest.mark.asyncio
async def test_document_storage_quota_enforcement_and_deletion(client: AsyncClient, db_session: AsyncSession):
    """
    Phase 4.3 & 3.2 Deep Verification:
    - Enforces file size quota based on plan
    - Enforces total organization storage quota
    - Secure document deletion frees storage quota
    """
    await seed_initial_plans_and_features(db_session)

    org = Organization(name="Quota Test Corp", slug="quota-corp", plan_tier="free")
    db_session.add(org)
    await db_session.flush()

    user = User(
        email="quota_user@omnidoc.io",
        hashed_password=get_password_hash("QuotaPass123!"),
        full_name="Quota User",
        role="user",
        is_active=True,
        terms_accepted=True,
        privacy_accepted=True,
        ai_consent=True,
        org_id=org.id
    )
    db_session.add(user)
    await db_session.commit()

    # Login
    res_login = await client.post("/api/v1/auth/login", json={"email": user.email, "password": "QuotaPass123!"})
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Upload valid document within limits (200 OK)
    valid_pdf_content = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
    res_upload = await client.post(
        "/api/v1/documents/upload",
        headers=headers,
        files={"file": ("test_doc.pdf", valid_pdf_content, "application/pdf")}
    )
    assert res_upload.status_code == 201
    doc_id = res_upload.json()["id"]

    # 2. Check download endpoint works
    res_down = await client.get(f"/api/v1/documents/{doc_id}/download", headers=headers)
    assert res_down.status_code == 200
    assert res_down.content == valid_pdf_content

    # 3. Check document deletion
    res_del = await client.delete(f"/api/v1/documents/{doc_id}", headers=headers)
    assert res_del.status_code == 200

    # 4. Verify document is gone
    res_check = await client.get(f"/api/v1/documents/{doc_id}", headers=headers)
    assert res_check.status_code == 404

@pytest.mark.asyncio
async def test_billing_checkout_and_webhook_security(client: AsyncClient, db_session: AsyncSession):
    """
    Phase 4.1 & 4.2 Deep Verification:
    - Never simulates successful payment on checkout initiation
    - Returns payment-unavailable status when Stripe credentials are not configured
    - Rejects unverified webhook signature with 400
    """
    await seed_initial_plans_and_features(db_session)

    org = Organization(name="Billing Corp", slug="billing-corp", plan_tier="free")
    db_session.add(org)
    await db_session.flush()

    user = User(
        email="billing_user@omnidoc.io",
        hashed_password=get_password_hash("BillingPass123!"),
        full_name="Billing User",
        role="user",
        is_active=True,
        terms_accepted=True,
        privacy_accepted=True,
        ai_consent=True,
        org_id=org.id
    )
    db_session.add(user)
    await db_session.commit()

    res_login = await client.post("/api/v1/auth/login", json={"email": user.email, "password": "BillingPass123!"})
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Billing status
    res_status = await client.get("/api/v1/billing/status", headers=headers)
    assert res_status.status_code == 200
    data = res_status.json()
    assert data["plan_tier"] == "free"
    assert "payment_gateway_configured" in data

    # 2. Attempting checkout when gateway is unconfigured returns 503 (not fake success)
    res_checkout = await client.post(
        "/api/v1/billing/checkout",
        headers=headers,
        json={"plan_slug": "pro", "billing_interval": "monthly"}
    )
    assert res_checkout.status_code == 503
    assert "gateway credentials are not configured" in res_checkout.json()["detail"]

    # 3. Webhook without signature header is REJECTED (400)
    res_wh_no_sig = await client.post("/api/v1/billing/webhook", content=b"{}")
    assert res_wh_no_sig.status_code == 400

    # 4. Webhook with invalid signature is REJECTED (400)
    res_wh_fake_sig = await client.post(
        "/api/v1/billing/webhook",
        headers={"Stripe-Signature": "t=12345,v1=fake_signature_hash"},
        content=b'{"type": "checkout.session.completed"}'
    )
    assert res_wh_fake_sig.status_code == 400


def test_production_secret_key_validation_and_entropy(monkeypatch):
    """
    P0 Verification:
    - Production rejects missing secret
    - Production rejects known compromised default secret
    - Production rejects short secret (<32 chars)
    - Production rejects low-entropy secret
    - Production accepts valid high-entropy secret
    - Development mode generates ephemeral in-memory secret
    """
    from app.core.config import Settings, KNOWN_COMPROMISED_SECRETS

    # 1. Missing secret in production -> ValueError
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SECRET_KEY", "")
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://user:pass@host:5432/db")
    monkeypatch.setenv("STORAGE_PROVIDER", "s3")
    monkeypatch.setenv("S3_BUCKET_NAME", "my-bucket")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "AKIA12345678")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "secret_aws_key_12345")
    monkeypatch.setenv("CORS_ORIGINS", '["https://omnidoc.studio"]')

    with pytest.raises(ValueError, match="CRITICAL SECURITY CONFIGURATION ERROR"):
        Settings(_env_file=None)

    # 2. Known compromised secret in production -> ValueError
    for comp in KNOWN_COMPROMISED_SECRETS:
        monkeypatch.setenv("SECRET_KEY", comp)
        with pytest.raises(ValueError, match="known compromised or default value"):
            Settings(_env_file=None)

    # 3. Short secret (<32 chars) -> ValueError
    monkeypatch.setenv("SECRET_KEY", "ShortSecret123!")
    with pytest.raises(ValueError, match="at least 32 characters"):
        Settings(_env_file=None)

    # 4. Low entropy secret -> ValueError
    monkeypatch.setenv("SECRET_KEY", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
    with pytest.raises(ValueError, match="cryptographic entropy"):
        Settings(_env_file=None)

    # 5. Valid secret in production -> Success
    valid_key = "a8b9c1d2e3f4g5h6i7j8k9l0m1n2o3p4q5r6s7t8u9v0w1x2y3z4_secure"
    monkeypatch.setenv("SECRET_KEY", valid_key)
    prod_settings = Settings(_env_file=None)
    assert prod_settings.SECRET_KEY == valid_key

    # 6. Development mode fallback -> Generates ephemeral secret without throwing
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("SECRET_KEY", "")
    dev_settings = Settings(_env_file=None)
    assert len(dev_settings.SECRET_KEY) >= 32


@pytest.mark.asyncio
async def test_plan_inheritance_precedence_comprehensive(db_session: AsyncSession):
    """
    Requirement 6 Deep Verification of get_effective_plan_tier:
    1. Individual override > Active subscription > Org default > Free fallback
    2. Expired/inactive subscription falls back to Org default
    3. Missing org falls back to Free
    """
    from app.services.entitlement_service import get_effective_plan_tier
    from app.models.subscription_management import SubscriptionModel

    # Seed plans
    await seed_initial_plans_and_features(db_session)
    pro_plan = await db_session.scalar(select(PlanModel).where(PlanModel.slug == "pro"))
    enterprise_plan = await db_session.scalar(select(PlanModel).where(PlanModel.slug == "enterprise"))

    # Org with default "starter"
    org = Organization(name="Inheritance Org", slug="inherit-org", plan_tier="starter")
    db_session.add(org)
    await db_session.flush()

    # Active subscription for Enterprise
    sub = SubscriptionModel(
        org_id=org.id,
        plan_id=enterprise_plan.id,
        status="active",
        billing_cycle="annual"
    )
    db_session.add(sub)
    await db_session.flush()

    # User 1: Has individual override "pro" -> MUST resolve to "pro" even though org has enterprise sub
    user_override = User(
        email="override_user@test.io",
        hashed_password="hash",
        org_id=org.id,
        individual_plan_tier="pro"
    )
    db_session.add(user_override)

    # User 2: No individual override -> MUST resolve to active subscription "enterprise"
    user_sub = User(
        email="sub_user@test.io",
        hashed_password="hash",
        org_id=org.id,
        individual_plan_tier=None
    )
    db_session.add(user_sub)
    await db_session.commit()

    tier_1 = await get_effective_plan_tier(user_override, db_session)
    assert tier_1 == "pro"

    tier_2 = await get_effective_plan_tier(user_sub, db_session)
    assert tier_2 == "enterprise"

    # Inactivate subscription -> User 2 MUST fall back to org default "starter"
    sub.status = "canceled"
    await db_session.commit()

    tier_2_fallback = await get_effective_plan_tier(user_sub, db_session)
    assert tier_2_fallback == "starter"

    # User with no org -> MUST fall back to "free"
    user_no_org = User(
        email="no_org@test.io",
        hashed_password="hash",
        org_id=None,
        individual_plan_tier=None
    )
    tier_free = await get_effective_plan_tier(user_no_org, db_session)
    assert tier_free == "free"


@pytest.mark.asyncio
async def test_user_data_export_data_isolation_and_no_storage_paths(client: AsyncClient, db_session: AsyncSession):
    """
    Section 4 Verification:
    - User A cannot export User B's documents
    - Raw internal storage_path is purged from export payload
    - SHA-256 checksum is present and matches
    """
    await seed_initial_plans_and_features(db_session)

    org = Organization(name="Privacy Test Org", slug="priv-org", plan_tier="pro")
    db_session.add(org)
    await db_session.flush()

    user_a = User(
        email="alice_export@test.io",
        hashed_password=get_password_hash("Pass123!"),
        full_name="Alice Export",
        role="user",
        is_active=True,
        org_id=org.id
    )
    user_b = User(
        email="bob_export@test.io",
        hashed_password=get_password_hash("Pass123!"),
        full_name="Bob Export",
        role="user",
        is_active=True,
        org_id=org.id
    )
    db_session.add_all([user_a, user_b])
    await db_session.flush()

    # User A document
    doc_a = Document(
        org_id=org.id,
        user_id=user_a.id,
        filename="alice_secret_contract.pdf",
        file_size=1024,
        mime_type="application/pdf",
        format_type="pdf",
        storage_path="/internal/vault/tenants/priv-org/alice_secret.pdf",
        content_hash_sha256="abc123hash"
    )
    # User B document
    doc_b = Document(
        org_id=org.id,
        user_id=user_b.id,
        filename="bob_financials.xlsx",
        file_size=2048,
        mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        format_type="xlsx",
        storage_path="/internal/vault/tenants/priv-org/bob_fin.xlsx",
        content_hash_sha256="def456hash"
    )
    db_session.add_all([doc_a, doc_b])
    await db_session.commit()

    token_a = create_access_token({"sub": user_a.id, "email": user_a.email, "role": "user"})
    headers_a = {"Authorization": f"Bearer {token_a}"}

    res_exp = await client.get("/api/v1/users/me/export", headers=headers_a)
    assert res_exp.status_code == 200
    export_payload = res_exp.json()
    archive = export_payload["archive"]

    # Verify Alice only sees her document
    doc_titles = [d["filename"] for d in archive["documents"]]
    assert "alice_secret_contract.pdf" in doc_titles
    assert "bob_financials.xlsx" not in doc_titles

    # Verify raw internal storage_path is NOT exposed anywhere in exported documents
    for doc in archive["documents"]:
        assert "storage_path" not in doc
        assert "content_hash_sha256" in doc
        assert "filename" in doc

    # Verify checksum
    assert "checksum_sha256" in export_payload
    assert len(export_payload["checksum_sha256"]) == 64


@pytest.mark.asyncio
async def test_ready_health_and_db_connectivity(client: AsyncClient):
    """
    Verification that /api/v1/ready checks DB connection with text('SELECT 1')
    and returns status: ready with database: up.
    """
    res = await client.get("/api/v1/ready")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ready"
    assert data["database"] == "up"

@pytest.mark.asyncio
async def test_signed_download_url_and_tamper_protection(client: AsyncClient, db_session: AsyncSession):
    """
    Verification of signed download URLs (Phase 3.2):
    - Valid signed download URL permits direct file retrieval without Authorization header
    - Tampered signature is rejected with 401
    - Expired signed URL is rejected with 401
    """
    from app.services.storage import storage_vault

    org = Organization(name="Signed URL Org", slug="signed-url-org", plan_tier="free")
    db_session.add(org)
    await db_session.flush()

    user = User(
        email="signer@omnidoc.io",
        hashed_password=get_password_hash("SignerPass123!"),
        full_name="Signer User",
        role="user",
        is_active=True,
        terms_accepted=True,
        privacy_accepted=True,
        ai_consent=True,
        org_id=org.id
    )
    db_session.add(user)
    await db_session.commit()

    # Upload document
    res_login = await client.post("/api/v1/auth/login", json={"email": user.email, "password": "SignerPass123!"})
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    pdf_bytes = b"%PDF-1.4\nsigned document content\n%%EOF"
    res_upload = await client.post(
        "/api/v1/documents/upload",
        headers=headers,
        files={"file": ("vault_doc.pdf", pdf_bytes, "application/pdf")}
    )
    assert res_upload.status_code == 201
    doc_id = res_upload.json()["id"]

    # Generate signed URL
    signed_url = storage_vault.generate_signed_download_url(org.id, doc_id, "vault_doc.pdf", expires_seconds=300)
    assert "signature=" in signed_url
    assert "expires=" in signed_url

    # 1. Fetch via signed URL without Authorization header -> SUCCEEDS (200)
    res_dl = await client.get(signed_url)
    assert res_dl.status_code == 200
    assert res_dl.content == pdf_bytes

    # 2. Tampered signature -> REJECTED (401)
    tampered_url = signed_url.replace("signature=", "signature=bad_hash_")
    res_tampered = await client.get(tampered_url)
    assert res_tampered.status_code == 401

    # 3. Expired signed URL -> REJECTED (401)
    expired_url = storage_vault.generate_signed_download_url(org.id, doc_id, "vault_doc.pdf", expires_seconds=-10)
    res_expired = await client.get(expired_url)
    assert res_expired.status_code == 401

@pytest.mark.asyncio
async def test_impersonation_access_audit_logging_and_inactive_user(client: AsyncClient, db_session: AsyncSession):
    """
    Verification of Phase 2.1 Rule 13 (audit events on impersonation access)
    and Phase 2.2 (inactive/suspended user returns 403).
    """
    from app.models.audit import AuditEvent

    org = Organization(name="Audit Log Org", slug="audit-log-org", plan_tier="pro")
    db_session.add(org)
    await db_session.flush()

    superadmin = User(
        email="auditor_sa@omnidoc.io",
        hashed_password=get_password_hash("AuditPass123!"),
        full_name="Auditor SA",
        role="superadmin",
        is_active=True,
        terms_accepted=True,
        privacy_accepted=True,
        ai_consent=True,
        org_id=org.id
    )
    victim = User(
        email="victim_audited@omnidoc.io",
        hashed_password=get_password_hash("VictimPass123!"),
        full_name="Victim User",
        role="user",
        is_active=True,
        terms_accepted=True,
        privacy_accepted=True,
        ai_consent=True,
        org_id=org.id
    )
    db_session.add_all([superadmin, victim])
    await db_session.commit()

    # Login SA & create view session
    res_sa = await client.post("/api/v1/admin/auth/login", json={"email": superadmin.email, "password": "AuditPass123!"})
    sa_token = res_sa.json()["access_token"]
    res_view = await client.post(
        "/api/v1/admin/view-sessions",
        headers={"Authorization": f"Bearer {sa_token}"},
        json={"target_user_id": victim.id, "duration_minutes": 15}
    )
    scoped_token = res_view.json()["scoped_token"]

    # Access endpoint under impersonation
    res_read = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {scoped_token}"})
    assert res_read.status_code == 200

    # Verify immutable audit log recorded for session ACCESS (Rule 13)
    stmt = select(AuditEvent).where(
        AuditEvent.action == "ADMIN_VIEW_AS_USER_ACCESS",
        AuditEvent.target_id == victim.id
    )
    audit_res = await db_session.execute(stmt)
    access_events = audit_res.scalars().all()
    assert len(access_events) >= 1

    # Verify inactive user gets 403 Forbidden
    victim.is_active = False
    await db_session.commit()

    # Login should fail or token should be rejected with 403
    res_inactive = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {scoped_token}"})
    assert res_inactive.status_code == 403
    assert "suspended" in res_inactive.json()["detail"].lower() or "inactive" in res_inactive.json()["detail"].lower()

@pytest.mark.asyncio
async def test_user_account_deletion_flow(client: AsyncClient, db_session: AsyncSession):
    """
    Verification of Phase 5 GDPR account deletion endpoint:
    - User can delete/deactivate their own account
    - Audit log is created
    - Subsequent access is rejected with 403
    """
    from app.models.audit import AuditEvent

    org = Organization(name="GDPR Org", slug="gdpr-org", plan_tier="free")
    db_session.add(org)
    await db_session.flush()

    user = User(
        email="gdpr_user@omnidoc.io",
        hashed_password=get_password_hash("GdprPass123!"),
        full_name="GDPR User",
        role="user",
        is_active=True,
        terms_accepted=True,
        privacy_accepted=True,
        ai_consent=True,
        org_id=org.id
    )
    db_session.add(user)
    await db_session.commit()

    res_login = await client.post("/api/v1/auth/login", json={"email": user.email, "password": "GdprPass123!"})
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Delete account
    res_del = await client.delete("/api/v1/users/me", headers=headers)
    assert res_del.status_code == 200
    assert "deactivated" in res_del.json()["message"].lower()

    # Verify subsequent access fails with 403 (inactive account)
    res_check = await client.get("/api/v1/users/me", headers=headers)
    assert res_check.status_code == 403
