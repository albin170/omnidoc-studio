import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from app.services.storage import SupabaseStorageAdapter, StorageVaultService
from app.core.config import settings

def test_supabase_adapter_path_traversal_and_tenant_isolation():
    adapter = SupabaseStorageAdapter(
        url="https://mock.supabase.co",
        key="mock-key-123",
        bucket_name="documents"
    )

    # Valid tenant path
    org_id = "org-test-123"
    valid_path = f"{org_id}/doc-456/sample.pdf"
    clean = adapter._validate_tenant_path(org_id, valid_path)
    assert clean == valid_path

    # Path traversal with .. rejected
    with pytest.raises(HTTPException) as exc:
        adapter._validate_tenant_path(org_id, f"{org_id}/../../../etc/passwd")
    assert exc.value.status_code in (400, 404)

    # Sibling prefix tenant isolation defense
    sibling_attacker = f"{org_id}-attacker"
    with pytest.raises(HTTPException) as exc_sibling:
        adapter._validate_tenant_path(sibling_attacker, valid_path)
    assert exc_sibling.value.status_code == 404

    # Completely different tenant
    with pytest.raises(HTTPException) as exc_other:
        adapter._validate_tenant_path("other-org", valid_path)
    assert exc_other.value.status_code == 404

def test_storage_vault_dispatches_to_supabase_when_enabled(monkeypatch):
    monkeypatch.setattr(settings, "STORAGE_PROVIDER", "supabase")
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://mock.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "mock-service-key")
    monkeypatch.setattr(settings, "SUPABASE_BUCKET_NAME", "documents")

    vault = StorageVaultService()
    assert vault.is_supabase_enabled is True
    assert vault.is_s3_enabled is False
    assert vault.is_local_enabled is False

    mock_client = MagicMock()
    mock_storage = MagicMock()
    mock_from = MagicMock()
    mock_client.storage = mock_storage
    mock_storage.from_.return_value = mock_from

    with patch.object(vault.supabase_adapter, "_get_client", return_value=mock_client):
        # Test download
        mock_from.download.return_value = b"Hello Supabase Storage"
        data = vault.read_file("org-abc", "org-abc/doc-1/file.txt")
        assert data == b"Hello Supabase Storage"
        mock_from.download.assert_called_once_with("org-abc/doc-1/file.txt")

        # Test delete
        mock_from.remove.return_value = True
        success = vault.delete_file("org-abc", "org-abc/doc-1/file.txt")
        assert success is True
        mock_from.remove.assert_called_once_with(["org-abc/doc-1/file.txt"])

