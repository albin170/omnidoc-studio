import pytest
from fastapi import HTTPException
from app.services.storage import storage_vault

@pytest.mark.asyncio
async def test_storage_vault_security_and_hashing():
    org_id = "test-org-101"
    doc_id = "doc-alpha-55"
    content = b"Financial statements for Q1 2026. Certified authentic."

    path, sha_hash, size = await storage_vault.save_file(org_id, doc_id, "report.txt", content)
    assert len(sha_hash) == 64
    assert size == len(content)

    # Read back correctly
    retrieved = storage_vault.read_file(org_id, path)
    assert retrieved == content

    # Test Path Traversal Defense
    with pytest.raises(HTTPException) as exc_info:
        await storage_vault.save_file("../../../etc", doc_id, "malicious.txt", content)
    assert exc_info.value.status_code in (400, 404)

    # Test Cross-Tenant Read Rejection
    with pytest.raises(HTTPException) as exc_read:
        storage_vault.read_file("wrong-org", path)
    assert exc_read.value.status_code == 404
