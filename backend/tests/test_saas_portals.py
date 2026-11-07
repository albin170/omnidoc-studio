import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.main import app
from app.models.user import User
from app.models.organization import Organization
from app.models.subscription_management import PlanModel, FeatureModel
from app.core.security import get_password_hash
from app.services.seed_data import seed_initial_plans_and_features

@pytest.mark.asyncio
async def test_admin_and_user_portal_workflow(client: AsyncClient, db_session: AsyncSession):
    # 1. Seed plans & features
    await seed_initial_plans_and_features(db_session)

    # 2. Create an admin user and a normal user
    org = Organization(name="Acme Corp", slug="acme-test-org", plan_tier="free")
    db_session.add(org)
    await db_session.flush()

    admin = User(
        email="superadmin@omnidoc.io",
        hashed_password=get_password_hash("AdminPass123!"),
        full_name="Super Admin",
        role="superadmin",
        is_active=True,
        terms_accepted=True,
        privacy_accepted=True,
        ai_consent=True,
        org_id=org.id
    )
    user = User(
        email="standard@omnidoc.io",
        hashed_password=get_password_hash("UserPass123!"),
        full_name="Standard User",
        role="user",
        is_active=True,
        terms_accepted=True,
        privacy_accepted=True,
        ai_consent=True,
        org_id=org.id
    )
    db_session.add(admin)
    db_session.add(user)
    await db_session.commit()

    # A. Normal user attempting admin login should be REJECTED (403)
    res = await client.post(
        "/api/v1/admin/auth/login",
        json={"email": "standard@omnidoc.io", "password": "UserPass123!"}
    )
    assert res.status_code == 403

    # B. Admin login succeeds (200)
    res_admin = await client.post(
        "/api/v1/admin/auth/login",
        json={"email": "superadmin@omnidoc.io", "password": "AdminPass123!"}
    )
    assert res_admin.status_code == 200
    admin_token = res_admin.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # C. User login on normal auth route succeeds
    res_user = await client.post(
        "/api/v1/auth/login",
        json={"email": "standard@omnidoc.io", "password": "UserPass123!"}
    )
    assert res_user.status_code == 200
    user_token = res_user.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # D. Normal user cannot access admin telemetry (403)
    res_fail = await client.get("/api/v1/admin/telemetry", headers=user_headers)
    assert res_fail.status_code == 403

    # E. Admin can access telemetry (200)
    res_telemetry = await client.get("/api/v1/admin/telemetry", headers=admin_headers)
    assert res_telemetry.status_code == 200
    tel = res_telemetry.json()
    assert tel["total_users"] >= 2
    assert tel["status"] == "HEALTHY"

    # F. Admin lists users
    res_users = await client.get("/api/v1/admin/users", headers=admin_headers)
    assert res_users.status_code == 200
    users_list = res_users.json()
    assert len(users_list) >= 2

    # G. Public plans listing for user pricing page
    res_plans = await client.get("/api/v1/plans")
    assert res_plans.status_code == 200
    plans_list = res_plans.json()
    assert len(plans_list) >= 4
    free_plan = [p for p in plans_list if p["slug"] == "free"][0]
    assert free_plan["monthly_price_cents"] == 0

    # H. User portal gets effective entitlements (standard Free user)
    res_ent = await client.get("/api/v1/users/me/entitlements", headers=user_headers)
    assert res_ent.status_code == 200
    ent = res_ent.json()
    assert ent["plan_slug"] == "free"
    assert "pdf_tools" in ent["enabled_features"]
    assert "autonomous_agent" not in ent["enabled_features"]

    # I. Individual User Override: Admin enables 'autonomous_agent' ONLY for this standard user!
    res_override = await client.put(
        f"/api/v1/admin/users/{user.id}/entitlements",
        headers=admin_headers,
        json={
            "feature_overrides": [{"feature_key": "autonomous_agent", "is_enabled": True}],
            "custom_storage_quota_bytes": 500 * 1024 * 1024, # 500MB
            "admin_notes": "VIP individual exception approved by admin"
        }
    )
    assert res_override.status_code == 200

    # J. User portal checks entitlements again: now 'autonomous_agent' is ENABLED with custom storage!
    res_ent_updated = await client.get("/api/v1/users/me/entitlements", headers=user_headers)
    assert res_ent_updated.status_code == 200
    ent_updated = res_ent_updated.json()
    assert "autonomous_agent" in ent_updated["enabled_features"]
    assert ent_updated["storage_quota_bytes"] == 500 * 1024 * 1024

    # K. Admin View-As-User Session: Admin can generate scoped view session for user
    res_view = await client.post(
        "/api/v1/admin/view-sessions",
        headers=admin_headers,
        json={"target_user_id": user.id, "duration_minutes": 15}
    )
    assert res_view.status_code == 200
    view_data = res_view.json()
    assert "scoped_token" in view_data
    assert view_data["target_user"]["email"] == "standard@omnidoc.io"

    # Terminate view session
    res_exit = await client.delete(
        f"/api/v1/admin/view-sessions/{view_data['view_session_id']}",
        headers=admin_headers
    )
    assert res_exit.status_code == 200

    # L. Suspend User: Admin suspends user account
    res_susp = await client.post(
        f"/api/v1/admin/users/{user.id}/suspend",
        headers=admin_headers,
        json={"reason": "Terms violation audit"}
    )
    assert res_susp.status_code == 200

    # M. Suspended user is BLOCKED from protected APIs (Phase 2.2: Consistent 403)
    res_ent_susp = await client.get("/api/v1/users/me/entitlements", headers=user_headers)
    assert res_ent_susp.status_code == 403
    assert "suspended" in res_ent_susp.json()["detail"].lower() or "inactive" in res_ent_susp.json()["detail"].lower()

    # N. Reactivate User
    res_react = await client.post(
        f"/api/v1/admin/users/{user.id}/reactivate",
        headers=admin_headers
    )
    assert res_react.status_code == 200

    # O. Admin Audit Logs contains recorded operations
    res_audit = await client.get("/api/v1/admin/audit-logs", headers=admin_headers)
    assert res_audit.status_code == 200
    logs = res_audit.json()
    assert len(logs) >= 4
