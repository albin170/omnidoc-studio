import os
import hashlib
from typing import Tuple, BinaryIO
from fastapi import HTTPException, status
from app.core.config import settings

class StorageVaultService:
    def __init__(self, base_dir: str = settings.STORAGE_DIR):
        self.base_dir = os.path.abspath(base_dir)
        os.makedirs(self.base_dir, exist_ok=True)

    def _resolve_tenant_dir(self, org_id: str) -> str:
        # Prevent path traversal
        if ".." in org_id or "/" in org_id or "\\" in org_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security violation: Path traversal detected"
            )
        tenant_path = os.path.abspath(os.path.join(self.base_dir, org_id))
        if not tenant_path.startswith(self.base_dir):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security violation: Path traversal detected"
            )
        os.makedirs(tenant_path, exist_ok=True)
        return tenant_path

    def _resolve_file_path(self, org_id: str, document_id: str, filename: str) -> str:
        if ".." in document_id or "/" in document_id or "\\" in document_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security violation: Path traversal detected"
            )
        if ".." in filename or "/" in filename or "\\" in filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security violation: Path traversal detected"
            )
        tenant_dir = self._resolve_tenant_dir(org_id)
        clean_doc_id = os.path.basename(document_id)
        clean_filename = os.path.basename(filename)
        file_dir = os.path.abspath(os.path.join(tenant_dir, clean_doc_id))
        os.makedirs(file_dir, exist_ok=True)
        
        target_path = os.path.abspath(os.path.join(file_dir, clean_filename))
        if not target_path.startswith(tenant_dir):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security violation: Invalid storage target"
            )
        return target_path

    async def save_file(
        self,
        org_id: str,
        document_id: str,
        filename: str,
        content: bytes
    ) -> Tuple[str, str, int]:
        """
        Saves a file into tenant-isolated storage.
        Returns: (absolute_storage_path, sha256_hash, file_size_bytes)
        """
        if len(content) > settings.MAX_UPLOAD_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds maximum allowed size ({settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB)"
            )

        target_path = self._resolve_file_path(org_id, document_id, filename)
        
        # Calculate SHA256
        hasher = hashlib.sha256()
        hasher.update(content)
        content_hash = hasher.hexdigest()

        # Atomic write
        temp_path = f"{target_path}.tmp"
        with open(temp_path, "wb") as f:
            f.write(content)
        os.replace(temp_path, target_path)

        return target_path, content_hash, len(content)

    def read_file(self, org_id: str, storage_path: str) -> bytes:
        """
        Reads a file ensuring it belongs to the tenant.
        """
        tenant_dir = self._resolve_tenant_dir(org_id)
        abs_target = os.path.abspath(storage_path)
        if not abs_target.startswith(tenant_dir) or not os.path.exists(abs_target):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document file not found in tenant storage"
            )
        with open(abs_target, "rb") as f:
            return f.read()

    def get_document_bytes(self, org_id: str, document_id: str) -> Tuple[str, bytes]:
        """
        Retrieves filename and file bytes for a document_id within the tenant vault.
        """
        tenant_dir = self._resolve_tenant_dir(org_id)
        clean_doc_id = os.path.basename(document_id)
        doc_dir = os.path.join(tenant_dir, clean_doc_id)
        if os.path.exists(doc_dir) and os.path.isdir(doc_dir):
            for fname in os.listdir(doc_dir):
                fpath = os.path.join(doc_dir, fname)
                if os.path.isfile(fpath) and not fname.endswith(".tmp"):
                    with open(fpath, "rb") as f:
                        return fname, f.read()
        return "", b""

    def delete_file(self, org_id: str, storage_path: str) -> bool:
        tenant_dir = self._resolve_tenant_dir(org_id)
        abs_target = os.path.abspath(storage_path)
        if abs_target.startswith(tenant_dir) and os.path.exists(abs_target):
            os.remove(abs_target)
            return True
        return False

storage_vault = StorageVaultService()
