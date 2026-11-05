import pytest
from httpx import AsyncClient
from app.schemas.auth import CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION, CURRENT_AI_CONSENT_VERSION

@pytest.mark.asyncio
async def test_register_login_and_user_isolation(client: AsyncClient):
    # Test registration fails when terms are not accepted
    res_fail = await client.post("/api/v1/auth/register", json={
        "email": "rejected@alpha-corp.com",
        "password": "Password123!",
        "full_name": "Rejected User",
        "organization_name": "Alpha Corp",
        "terms_accepted": False,
        "privacy_accepted": True,
        "ai_consent": True
    })
    assert res_fail.status_code == 422

    # Test registration fails when outdated policy version provided
    res_outdated = await client.post("/api/v1/auth/register", json={
        "email": "outdated@alpha-corp.com",
        "password": "Password123!",
        "full_name": "Outdated User",
        "organization_name": "Alpha Corp",
        "terms_accepted": True,
        "terms_version": "1999.0",
        "privacy_accepted": True,
        "privacy_version": CURRENT_PRIVACY_VERSION,
        "ai_consent": True
    })
    assert res_outdated.status_code == 400
    assert "Outdated Terms of Service version" in res_outdated.json()["detail"]

    # Register Organization A with valid consent
    res_a = await client.post("/api/v1/auth/register", json={
        "email": "alice@alpha-corp.com",
        "password": "Password123!",
        "full_name": "Alice Architect",
        "organization_name": "Alpha Corp",
        "terms_accepted": True,
        "terms_version": CURRENT_TERMS_VERSION,
        "privacy_accepted": True,
        "privacy_version": CURRENT_PRIVACY_VERSION,
        "ai_consent": True,
        "ai_consent_version": CURRENT_AI_CONSENT_VERSION,
        "marketing_consent": True
    })
    assert res_a.status_code == 201
    user_a = res_a.json()
    assert user_a["role"] == "admin"
    assert user_a["email"] == "alice@alpha-corp.com"
    assert user_a["terms_accepted"] is True
    assert user_a["marketing_consent"] is True

    # Login User A via JSON login endpoint
    login_a_json = await client.post("/api/v1/auth/login", json={
        "email": "alice@alpha-corp.com",
        "password": "Password123!"
    })
    assert login_a_json.status_code == 200
    assert login_a_json.json()["role"] == "admin"

    # Login User A via OAuth2 token endpoint
    login_a = await client.post("/api/v1/auth/token", data={
        "username": "alice@alpha-corp.com",
        "password": "Password123!"
    })
    assert login_a.status_code == 200
    token_a = login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Verify Profile A and consent records
    me_a = await client.get("/api/v1/auth/me", headers=headers_a)
    assert me_a.status_code == 200
    assert me_a.json()["id"] == user_a["id"]
    assert len(me_a.json()["consent_records"]) >= 4

    # Verify consent history
    history_res = await client.get("/api/v1/auth/consent/history", headers=headers_a)
    assert history_res.status_code == 200
    history = history_res.json()
    assert len(history) >= 4

    # Withdraw optional marketing consent
    withdraw_res = await client.post(
        "/api/v1/auth/consent/withdraw",
        headers=headers_a,
        json={"consent_type": "marketing_communication"}
    )
    assert withdraw_res.status_code == 200
    assert withdraw_res.json()["granted"] is False

    # Attempt to withdraw required Terms - should fail
    withdraw_terms_res = await client.post(
        "/api/v1/auth/consent/withdraw",
        headers=headers_a,
        json={"consent_type": "terms_and_conditions"}
    )
    assert withdraw_terms_res.status_code == 400

    # Register Organization B
    res_b = await client.post("/api/v1/auth/register", json={
        "email": "bob@beta-tech.com",
        "password": "Password999!",
        "full_name": "Bob Builder",
        "organization_name": "Beta Tech",
        "terms_accepted": True,
        "terms_version": CURRENT_TERMS_VERSION,
        "privacy_accepted": True,
        "privacy_version": CURRENT_PRIVACY_VERSION,
        "ai_consent": True,
        "ai_consent_version": CURRENT_AI_CONSENT_VERSION,
        "marketing_consent": False
    })
    assert res_b.status_code == 201
    user_b = res_b.json()
    assert user_b["org_id"] != user_a["org_id"]

    # Login User B
    login_b = await client.post("/api/v1/auth/token", data={
        "username": "bob@beta-tech.com",
        "password": "Password999!"
    })
    token_b = login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Upload document under Org A
    doc_a_res = await client.post(
        "/api/v1/documents/upload",
        headers=headers_a,
        files={"file": ("alpha_secret.pdf", b"%PDF-1.4 mock content for alpha", "application/pdf")}
    )
    assert doc_a_res.status_code == 201
    doc_a_id = doc_a_res.json()["id"]

    # Org B attempts to access Org A's document -> Expect 404 (or 403) isolation enforcement
    leak_check = await client.get(f"/api/v1/documents/{doc_a_id}", headers=headers_b)
    assert leak_check.status_code in (403, 404)

    # Logout User A
    logout_res = await client.post("/api/v1/auth/logout", headers=headers_a)
    assert logout_res.status_code == 200
