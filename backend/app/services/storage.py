import os
import time
import hmac
import hashlib
from typing import Tuple, BinaryIO, Optional
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
        try:
            if os.path.commonpath([self.base_dir, tenant_path]) != self.base_dir:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Security violation: Path traversal detected"
                )
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security violation: Cross-drive traversal detected"
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
        try:
            if os.path.commonpath([tenant_dir, target_path]) != tenant_dir:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Security violation: Invalid storage target"
                )
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security violation: Cross-drive storage target"
            )
        return target_path

    @property
    def is_s3_enabled(self) -> bool:
        return getattr(settings, "STORAGE_PROVIDER", "local").lower() == "s3"

    def _get_s3_client(self):
        try:
            import boto3
            client_kwargs = {
                "service_name": "s3",
                "region_name": settings.AWS_REGION,
            }
            if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
                client_kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
                client_kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
            if settings.S3_ENDPOINT_URL:
                client_kwargs["endpoint_url"] = settings.S3_ENDPOINT_URL
            return boto3.client(**client_kwargs)
        except ImportError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Object storage error: boto3 library is not installed on this environment."
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Object storage connection error: {e}"
            )

    async def save_file(
        self,
        org_id: str,
        document_id: str,
        filename: str,
        content: bytes
    ) -> Tuple[str, str, int]:
        """
        Saves a file into tenant-isolated storage (Local or S3/R2).
        Returns: (absolute_storage_path_or_key, sha256_hash, file_size_bytes)
        """
        if len(content) > settings.MAX_UPLOAD_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds maximum allowed size ({settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB)"
            )

        hasher = hashlib.sha256()
        hasher.update(content)
        content_hash = hasher.hexdigest()

        if self.is_s3_enabled:
            s3 = self._get_s3_client()
            bucket = settings.S3_BUCKET_NAME
            if not bucket:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="S3_BUCKET_NAME must be configured when STORAGE_PROVIDER=s3"
                )
            clean_doc_id = os.path.basename(document_id)
            clean_filename = os.path.basename(filename)
            s3_key = f"{org_id}/{clean_doc_id}/{clean_filename}"
            try:
                s3.put_object(Bucket=bucket, Key=s3_key, Body=content)
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Failed to persist document to object storage: {e}"
                )
            return s3_key, content_hash, len(content)

        target_path = self._resolve_file_path(org_id, document_id, filename)
        
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
        if self.is_s3_enabled:
            s3 = self._get_s3_client()
            bucket = settings.S3_BUCKET_NAME
            try:
                resp = s3.get_object(Bucket=bucket, Key=storage_path)
                return resp["Body"].read()
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Document file not found in tenant object storage"
                )

        tenant_dir = self._resolve_tenant_dir(org_id)
        abs_target = os.path.abspath(storage_path)
        try:
            if os.path.commonpath([tenant_dir, abs_target]) != tenant_dir or not os.path.exists(abs_target):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Document file not found in tenant storage"
                )
        except ValueError:
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
        if self.is_s3_enabled:
            s3 = self._get_s3_client()
            bucket = settings.S3_BUCKET_NAME
            try:
                s3.delete_object(Bucket=bucket, Key=storage_path)
                return True
            except Exception:
                return False

        tenant_dir = self._resolve_tenant_dir(org_id)
        abs_target = os.path.abspath(storage_path)
        try:
            if os.path.commonpath([tenant_dir, abs_target]) == tenant_dir and os.path.exists(abs_target):
                os.remove(abs_target)
                parent_dir = os.path.dirname(abs_target)
                # Cleanup empty doc directory if no files remain
                try:
                    if os.path.exists(parent_dir) and not os.listdir(parent_dir):
                        os.rmdir(parent_dir)
                except Exception:
                    pass
                return True
        except ValueError:
            return False
        return False

    def generate_signed_download_url(self, org_id: str, document_id: str, filename: str, expires_seconds: int = 900) -> str:
        """
        Generates a direct or API-proxied signed download URL with cryptographic tamper resistance.
        """
        if self.is_s3_enabled:
            s3 = self._get_s3_client()
            bucket = settings.S3_BUCKET_NAME
            clean_doc_id = os.path.basename(document_id)
            clean_filename = os.path.basename(filename)
            s3_key = f"{org_id}/{clean_doc_id}/{clean_filename}"
            try:
                return s3.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": bucket, "Key": s3_key},
                    ExpiresIn=expires_seconds
                )
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Presigned S3 download URL generation failed: {e}"
                )

        target_path = self._resolve_file_path(org_id, document_id, filename)
        if not os.path.exists(target_path):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target document not found")

        # Cryptographically signed download URL (HMAC-SHA256)
        expires_at = int(time.time()) + expires_seconds
        payload = f"{org_id}:{document_id}:{expires_at}"
        sig = hmac.new(settings.SECRET_KEY.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
        return f"{settings.API_V1_STR}/documents/{document_id}/download?org_id={org_id}&expires={expires_at}&signature={sig}"

storage_vault = StorageVaultService()
