import os
import time
import hmac
import hashlib
import logging
import mimetypes
from typing import Tuple, Optional, List
from fastapi import HTTPException, status
from app.core.config import settings

logger = logging.getLogger("omnidoc.storage")

class SupabaseStorageAdapter:
    """
    Supabase Storage Adapter managing private bucket objects with tenant isolation.
    Path structure: {org_id}/{clean_doc_id}/{clean_filename}
    """
    def __init__(
        self,
        url: Optional[str] = None,
        key: Optional[str] = None,
        bucket_name: Optional[str] = None
    ):
        self.url = url or settings.SUPABASE_URL
        self.key = key or settings.SUPABASE_SERVICE_ROLE_KEY
        self.bucket_name = bucket_name or getattr(settings, "SUPABASE_BUCKET_NAME", "documents")
        self._client = None

    def _get_client(self):
        if self._client is not None:
            return self._client
        if not self.url or not self.key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Supabase storage configuration missing: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
            )
        try:
            from supabase import create_client
            self._client = create_client(self.url, self.key)
            return self._client
        except Exception as e:
            logger.error("Failed to initialize Supabase client: %s", e)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Supabase storage service connection failed: {e}"
            )

    def _validate_tenant_path(self, org_id: str, storage_path: str) -> str:
        """
        Validates tenant isolation and defends against path traversal.
        """
        if not org_id or ".." in org_id or "/" in org_id or "\\" in org_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security violation: Invalid tenant identifier."
            )
        clean_path = storage_path.replace("\\", "/").strip("/")
        if ".." in clean_path:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security violation: Path traversal detected in storage path."
            )
        expected_prefix = f"{org_id}/"
        if not clean_path.startswith(expected_prefix):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document file not found in tenant object storage."
            )
        return clean_path

    def upload_file(
        self,
        org_id: str,
        document_id: str,
        filename: str,
        content: bytes,
        content_type: Optional[str] = None
    ) -> str:
        if not org_id or ".." in org_id or "/" in org_id or "\\" in org_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security violation: Path traversal detected in org_id"
            )
        if not document_id or ".." in document_id or "/" in document_id or "\\" in document_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security violation: Path traversal detected in document_id"
            )
        if not filename or ".." in filename or "/" in filename or "\\" in filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security violation: Path traversal detected in filename"
            )

        client = self._get_client()
        clean_doc_id = os.path.basename(document_id).replace("..", "")
        clean_filename = os.path.basename(filename).replace("..", "")
        object_path = f"{org_id}/{clean_doc_id}/{clean_filename}"
        
        guessed_type, _ = mimetypes.guess_type(clean_filename)
        mime = content_type or guessed_type or "application/octet-stream"

        # Retry up to 3 times on network hiccups
        max_attempts = 3
        last_error = None
        for attempt in range(1, max_attempts + 1):
            try:
                client.storage.from_(self.bucket_name).upload(
                    path=object_path,
                    file=content,
                    file_options={"content-type": mime, "upsert": "true"}
                )
                logger.info("Successfully uploaded object to Supabase Storage: %s", object_path)
                return object_path
            except Exception as e:
                last_error = e
                err_msg = str(e)
                if "Duplicate" in err_msg or "already exists" in err_msg:
                    # Idempotent success
                    return object_path
                logger.warning("Supabase upload attempt %d/%d failed: %s", attempt, max_attempts, e)
                if attempt < max_attempts:
                    time.sleep(0.5 * attempt)

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to persist document to Supabase Storage: {last_error}"
        )

    def download_file(self, org_id: str, storage_path: str) -> bytes:
        clean_path = self._validate_tenant_path(org_id, storage_path)
        client = self._get_client()
        try:
            return client.storage.from_(self.bucket_name).download(clean_path)
        except Exception as e:
            err_msg = str(e).lower()
            if "not found" in err_msg or "404" in err_msg:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Document file not found in Supabase Storage."
                )
            logger.error("Supabase Storage download error for %s: %s", clean_path, e)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Supabase Storage download failed: {e}"
            )

    def delete_file(self, org_id: str, storage_path: str) -> bool:
        try:
            clean_path = self._validate_tenant_path(org_id, storage_path)
        except HTTPException:
            return False
        client = self._get_client()
        try:
            client.storage.from_(self.bucket_name).remove([clean_path])
            return True
        except Exception as e:
            logger.warning("Supabase Storage delete error for %s: %s", clean_path, e)
            return False

    def file_exists(self, org_id: str, storage_path: str) -> bool:
        try:
            clean_path = self._validate_tenant_path(org_id, storage_path)
            client = self._get_client()
            res = client.storage.from_(self.bucket_name).exists(clean_path)
            return bool(res)
        except Exception:
            return False

    def create_signed_url(self, org_id: str, storage_path: str, expires_seconds: int = 900) -> str:
        clean_path = self._validate_tenant_path(org_id, storage_path)
        client = self._get_client()
        try:
            res = client.storage.from_(self.bucket_name).create_signed_url(
                path=clean_path,
                expires_in=expires_seconds
            )
            if isinstance(res, dict) and "signedURL" in res:
                return res["signedURL"]
            if isinstance(res, dict) and "signedUrl" in res:
                return res["signedUrl"]
            return str(res)
        except Exception as e:
            logger.error("Supabase Storage create_signed_url error for %s: %s", clean_path, e)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Failed to generate Supabase signed URL: {e}"
            )


class StorageVaultService:
    def __init__(self, base_dir: str = settings.STORAGE_DIR):
        self.base_dir = os.path.abspath(base_dir)
        os.makedirs(self.base_dir, exist_ok=True)
        self._supabase_adapter = None

    @property
    def provider(self) -> str:
        return getattr(settings, "STORAGE_PROVIDER", "local").lower().strip()

    @property
    def is_supabase_enabled(self) -> bool:
        return self.provider == "supabase"

    @property
    def is_s3_enabled(self) -> bool:
        return self.provider == "s3"

    @property
    def is_local_enabled(self) -> bool:
        return self.provider in ("local", "")

    @property
    def supabase_adapter(self) -> SupabaseStorageAdapter:
        if self._supabase_adapter is None:
            self._supabase_adapter = SupabaseStorageAdapter()
        return self._supabase_adapter

    def _assert_production_storage_safety(self):
        """
        Guards against silent local filesystem fallback in production environments.
        """
        env = getattr(settings, "ENVIRONMENT", "").lower()
        is_cloud_prod = bool(
            env in ("production", "prod") or
            os.getenv("K_SERVICE") or
            os.getenv("VERCEL") or
            os.getenv("RENDER")
        )
        if is_cloud_prod and self.is_local_enabled:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Production environment requires persistent object storage (STORAGE_PROVIDER=supabase or s3). Ephemeral local storage is strictly prohibited."
            )

    def _resolve_tenant_dir(self, org_id: str) -> str:
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
                detail="Object storage error: boto3 library is not installed."
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
        content: bytes,
        content_type: Optional[str] = None
    ) -> Tuple[str, str, int]:
        """
        Saves a file into tenant-isolated storage (Supabase, S3, or Local).
        Returns: (storage_path_or_key, sha256_hash, file_size_bytes)
        """
        if len(content) > settings.MAX_UPLOAD_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds maximum allowed size ({settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB)"
            )

        self._assert_production_storage_safety()

        hasher = hashlib.sha256()
        hasher.update(content)
        content_hash = hasher.hexdigest()

        # 1. Supabase Storage Provider
        if self.is_supabase_enabled:
            storage_key = self.supabase_adapter.upload_file(
                org_id=org_id,
                document_id=document_id,
                filename=filename,
                content=content,
                content_type=content_type
            )
            return storage_key, content_hash, len(content)

        # 2. S3 Storage Provider
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

        # 3. Local Storage Provider (Development Only)
        target_path = self._resolve_file_path(org_id, document_id, filename)
        temp_path = f"{target_path}.tmp"
        with open(temp_path, "wb") as f:
            f.write(content)
        os.replace(temp_path, target_path)

        return target_path, content_hash, len(content)

    def read_file(self, org_id: str, storage_path: str) -> bytes:
        """
        Reads a file ensuring it belongs to the tenant.
        """
        if self.is_supabase_enabled:
            return self.supabase_adapter.download_file(org_id, storage_path)

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
        clean_doc_id = os.path.basename(document_id)

        if self.is_supabase_enabled:
            prefix = f"{org_id}/{clean_doc_id}"
            try:
                client = self.supabase_adapter._get_client()
                file_list = client.storage.from_(self.supabase_adapter.bucket_name).list(prefix)
                if file_list and isinstance(file_list, list) and len(file_list) > 0:
                    first_file = file_list[0].get("name", "")
                    full_path = f"{prefix}/{first_file}"
                    data = self.supabase_adapter.download_file(org_id, full_path)
                    return first_file, data
            except Exception as e:
                logger.warning("Supabase get_document_bytes error: %s", e)
            return "", b""

        tenant_dir = self._resolve_tenant_dir(org_id)
        doc_dir = os.path.join(tenant_dir, clean_doc_id)
        if os.path.exists(doc_dir) and os.path.isdir(doc_dir):
            for fname in os.listdir(doc_dir):
                fpath = os.path.join(doc_dir, fname)
                if os.path.isfile(fpath) and not fname.endswith(".tmp"):
                    with open(fpath, "rb") as f:
                        return fname, f.read()
        return "", b""

    def delete_file(self, org_id: str, storage_path: str) -> bool:
        if self.is_supabase_enabled:
            return self.supabase_adapter.delete_file(org_id, storage_path)

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
        Generates an API-proxied signed download URL with cryptographic HMAC-SHA256 tamper resistance.
        Downloads are verified, audited, and streamed directly from the active storage provider.
        """
        if ".." in org_id or "/" in org_id or "\\" in org_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Security violation: Path traversal detected")
        if ".." in document_id or "/" in document_id or "\\" in document_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Security violation: Path traversal detected")
        if ".." in filename or "/" in filename or "\\" in filename:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Security violation: Path traversal detected")

        # Cryptographically signed download URL (HMAC-SHA256)
        expires_at = int(time.time()) + expires_seconds
        payload = f"{org_id}:{document_id}:{expires_at}"
        sig = hmac.new(settings.SECRET_KEY.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
        return f"{settings.API_V1_STR}/documents/{document_id}/download?org_id={org_id}&expires={expires_at}&signature={sig}"

storage_vault = StorageVaultService()
