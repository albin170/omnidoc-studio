import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_register_login_and_user_isolation(client: AsyncClient):
    # Register Organization A
    res_a = await client.post("/api/v1/auth/register", json={
        "email": "alice@alpha-corp.com",
        "password": "Password123!",
        "full_name": "Alice Architect",
        "organization_name": "Alpha Corp"
    })
    assert res_a.status_code == 201
    user_a = res_a.json()
    assert user_a["role"] == "admin"
    assert user_a["email"] == "alice@alpha-corp.com"

    # Login User A
    login_a = await client.post("/api/v1/auth/token", data={
        "username": "alice@alpha-corp.com",
        "password": "Password123!"
    })
    assert login_a.status_code == 200
    token_a = login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Verify Profile A
    me_a = await client.get("/api/v1/auth/me", headers=headers_a)
    assert me_a.status_code == 200
    assert me_a.json()["id"] == user_a["id"]

    # Register Organization B
    res_b = await client.post("/api/v1/auth/register", json={
        "email": "bob@beta-tech.com",
        "password": "Password999!",
        "full_name": "Bob Builder",
        "organization_name": "Beta Tech"
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

    # User A uploads a document
    doc_file = ("invoice_alpha.txt", b"Alpha Confidential Invoice: $5000", "text/plain")
    upload_res = await client.post(
        "/api/v1/documents/upload",
        files={"file": doc_file},
        headers=headers_a
    )
    assert upload_res.status_code == 201
    doc_id_a = upload_res.json()["id"]

    # Tenant Isolation: User B tries to view or download User A's document -> Must be 404
    access_attempt = await client.get(f"/api/v1/documents/{doc_id_a}", headers=headers_b)
    assert access_attempt.status_code == 404

    # Tenant Isolation: User B lists documents -> Must not see User A's document
    list_b = await client.get("/api/v1/documents", headers=headers_b)
    assert list_b.status_code == 200
    assert len(list_b.json()) == 0

    # User A lists documents -> Sees own document
    list_a = await client.get("/api/v1/documents", headers=headers_a)
    assert list_a.status_code == 200
    assert len(list_a.json()) == 1
    assert list_a.json()[0]["id"] == doc_id_a
