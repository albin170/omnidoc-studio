import pytest
import time
from httpx import AsyncClient
from jose import jwt
from app.core.config import settings
from app.schemas.auth import CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION, CURRENT_AI_CONSENT_VERSION

@pytest.mark.asyncio
async def test_complete_auth_lifecycle_and_idor_protection(client: AsyncClient):
    # 1. Register User 1
    email_1 = "tenant1_user@domain.com"
    pwd_1 = "StrongPassword123!"
    res_reg1 = await client.post("/api/v1/auth/register", json={
        "email": email_1,
        "password": pwd_1,
        "full_name": "Tenant One",
        "organization_name": "Tenant One Corp",
        "terms_accepted": True,
        "terms_version": CURRENT_TERMS_VERSION,
        "privacy_accepted": True,
        "privacy_version": CURRENT_PRIVACY_VERSION,
        "ai_consent": True,
        "ai_consent_version": CURRENT_AI_CONSENT_VERSION
    })
    assert res_reg1.status_code == 201
    user1 = res_reg1.json()

    # 2. Register User 2
    email_2 = "tenant2_user@domain.com"
    pwd_2 = "StrongPassword456!"
    res_reg2 = await client.post("/api/v1/auth/register", json={
        "email": email_2,
        "password": pwd_2,
        "full_name": "Tenant Two",
        "organization_name": "Tenant Two Corp",
        "terms_accepted": True,
        "terms_version": CURRENT_TERMS_VERSION,
        "privacy_accepted": True,
        "privacy_version": CURRENT_PRIVACY_VERSION,
        "ai_consent": True,
        "ai_consent_version": CURRENT_AI_CONSENT_VERSION
    })
    assert res_reg2.status_code == 201
    user2 = res_reg2.json()

    # 3. Login User 1 & User 2
    login1 = await client.post("/api/v1/auth/login", json={"email": email_1, "password": pwd_1})
    assert login1.status_code == 200
    token1 = login1.json()["access_token"]
    headers1 = {"Authorization": f"Bearer {token1}"}

    login2 = await client.post("/api/v1/auth/login", json={"email": email_2, "password": pwd_2})
    assert login2.status_code == 200
    token2 = login2.json()["access_token"]
    headers2 = {"Authorization": f"Bearer {token2}"}

    # 4. User 1 uploads a document
    upload_res = await client.post(
        "/api/v1/documents/upload",
        headers=headers1,
        files={"file": ("tenant1_confidential.pdf", b"%PDF-1.5 sensitive tenant 1 data", "application/pdf")}
    )
    assert upload_res.status_code == 201
    doc1_id = upload_res.json()["id"]

    # 5. IDOR Attack: User 2 tries to read document details of User 1 -> 404
    idor_read = await client.get(f"/api/v1/documents/{doc1_id}", headers=headers2)
    assert idor_read.status_code == 404

    # 6. IDOR Attack: User 2 tries to download User 1's document -> 404
    idor_dl = await client.get(f"/api/v1/documents/{doc1_id}/download", headers=headers2)
    assert idor_dl.status_code == 404

    # 7. IDOR Attack: User 2 tries to delete User 1's document -> 404
    idor_del = await client.delete(f"/api/v1/documents/{doc1_id}", headers=headers2)
    assert idor_del.status_code == 404

    # 8. Unauthenticated download fails with 401
    unauth_dl = await client.get(f"/api/v1/documents/{doc1_id}/download")
    assert unauth_dl.status_code == 401

    # 9. Token Expiration: Malformed / Expired token rejected
    expired_payload = {
        "sub": user1["id"],
        "org_id": user1["org_id"],
        "role": "user",
        "exp": int(time.time()) - 3600
    }
    expired_token = jwt.encode(expired_payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    res_expired = await client.get("/api/v1/documents", headers={"Authorization": f"Bearer {expired_token}"})
    assert res_expired.status_code == 401

    # 10. Legitimate download by User 1 succeeds
    legit_dl = await client.get(f"/api/v1/documents/{doc1_id}/download", headers=headers1)
    assert legit_dl.status_code == 200
    assert b"sensitive tenant 1 data" in legit_dl.content

    # 11. Legitimate delete by User 1 succeeds
    legit_del = await client.delete(f"/api/v1/documents/{doc1_id}", headers=headers1)
    assert legit_del.status_code == 200
