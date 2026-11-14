import os
import uuid
import time
import json
import logging
import hmac
import hashlib
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, Response, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.rate_limit import rate_limiter
from app.core.config import settings
from app.models.user import User
from app.models.organization import Organization
from app.models.document import Document
from app.models.audit import AuditEvent
from app.schemas.document import DocumentOut, DocumentDetailOut
from app.schemas.digital_twin import DocumentDigitalTwin
from app.services.storage import storage_vault
from app.services.parser import document_parser
from app.services.entitlement_service import calculate_user_entitlements

logger = logging.getLogger("omnidoc.documents")

router = APIRouter(prefix="/documents", tags=["Documents"])

import zipfile
import io

def validate_magic_bytes(content: bytes, ext: str):
    if ext == "pdf":
        if not content.startswith(b"%PDF-"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Corrupted file or invalid PDF signature")
    elif ext == "png":
        if not content.startswith(b"\x89PNG\r\n\x1a\n"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid PNG image signature")
    elif ext in ("jpg", "jpeg"):
        if not content.startswith(b"\xff\xd8\xff"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JPEG image signature")
    elif ext == "webp":
        if not (len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid WebP image signature")
    elif ext in ("docx", "xlsx", "pptx"):
        if not content.startswith(b"PK\x03\x04"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid OpenXML container signature for {ext.upper()}")
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as z:
                total_uncompressed = sum(info.file_size for info in z.infolist())
                if total_uncompressed > settings.MAX_ARCHIVE_EXPANSION_BYTES:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"Decompressed archive exceeds maximum safe expansion limit ({settings.MAX_ARCHIVE_EXPANSION_BYTES // (1024 * 1024)}MB)"
                    )
        except zipfile.BadZipFile:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Malformed or corrupted archive")
    elif ext in ("csv", "txt", "md", "html"):
        try:
            content.decode("utf-8")
        except UnicodeDecodeError:
            try:
                content.decode("latin1")
            except Exception:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Non-text binary detected for text file")

@router.post("/upload", response_model=DocumentOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(rate_limiter(max_requests=30, window_seconds=60))])
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    filename = os.path.basename(file.filename or "uploaded_file").replace("\x00", "")
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported format '{ext}'. Allowed: {sorted(list(settings.ALLOWED_EXTENSIONS))}"
        )

    # Server-Side Entitlements calculated before streaming to resolve global limit conflict (Section 4.B)
    entitlements = await calculate_user_entitlements(current_user, db)

    # Bounded chunk streaming to prevent memory exhaustion, capped by plan max_file_size_bytes
    max_allowed = min(settings.MAX_UPLOAD_SIZE_BYTES, entitlements.max_file_size_bytes)
    chunk_size = 64 * 1024
    chunks: list[bytes] = []
    total_bytes = 0
    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        total_bytes += len(chunk)
        if total_bytes > max_allowed:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds plan maximum allowed file size ({entitlements.max_file_size_bytes // (1024 * 1024)}MB)."
            )
        chunks.append(chunk)

    content = b"".join(chunks)

    # Concurrency-safe quota verification: lock organization row
    await db.scalar(
        select(Organization).where(Organization.id == current_user.org_id).with_for_update()
    )

    # Enforce plan document upload count limit within lock (Section 4.B)
    if entitlements.upload_limit > 0:
        doc_count = await db.scalar(
            select(func.count(Document.id)).where(Document.org_id == current_user.org_id)
        ) or 0
        if doc_count >= entitlements.upload_limit:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Plan document upload limit reached ({entitlements.upload_limit} documents). Upgrade your plan or delete existing documents."
            )

    used_storage = await db.scalar(
        select(func.sum(Document.file_size)).where(Document.org_id == current_user.org_id)
    ) or 0

    if used_storage + total_bytes > entitlements.storage_quota_bytes:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Storage quota exceeded for your subscription tier. Upgrade your plan or delete existing documents."
        )

    # Validate file signatures and archive bounds before saving
    validate_magic_bytes(content, ext)

    doc_id = str(uuid.uuid4())
    storage_path, content_hash, file_size = await storage_vault.save_file(
        org_id=current_user.org_id,
        document_id=doc_id,
        filename=filename,
        content=content
    )

    try:
        # Parse initial Document Digital Twin
        digital_twin = document_parser.parse_document(
            document_id=doc_id,
            filename=filename,
            content=content,
            format_type=ext
        )

        new_doc = Document(
            id=doc_id,
            org_id=current_user.org_id,
            user_id=current_user.id,
            filename=filename,
            file_size=file_size,
            mime_type=file.content_type or f"application/{ext}",
            format_type=ext,
            storage_path=storage_path,
            content_hash_sha256=content_hash,
            digital_twin_json=digital_twin.model_dump_json(),
            version=1
        )

        db.add(new_doc)

        doc_org_id = current_user.org_id
        if not doc_org_id:
            doc_org_id = await db.scalar(select(Organization.id).limit(1))
        if doc_org_id:
            audit = AuditEvent(
                org_id=doc_org_id,
                user_id=current_user.id,
                action="DOCUMENT_UPLOADED",
                target_type="document",
                target_id=doc_id,
                details_json=json.dumps({"filename": filename, "file_size": file_size}),
                timestamp=datetime.now(timezone.utc).replace(tzinfo=None)
            )
            db.add(audit)

        await db.commit()
        await db.refresh(new_doc)
        return new_doc
    except Exception as e:
        # Consistency recovery: purge saved storage artifact if database persistence or parsing fails (Section 4.C)
        try:
            storage_vault.delete_file(org_id=current_user.org_id, storage_path=storage_path)
        except Exception as cleanup_err:
            logger.error("Failed to clean up orphaned storage artifact: %s", cleanup_err)
        await db.rollback()
        raise e

@router.get("", response_model=List[DocumentOut])
async def list_tenant_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Document).where(Document.org_id == current_user.org_id).order_by(Document.created_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()

@router.get("/{document_id}", response_model=DocumentDetailOut)
async def get_document_details(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Document).where(
        Document.id == document_id,
        Document.org_id == current_user.org_id
    )
    res = await db.execute(stmt)
    doc = res.scalars().first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    twin_obj = None
    if doc.digital_twin_json:
        try:
            twin_obj = DocumentDigitalTwin.model_validate_json(doc.digital_twin_json)
        except Exception:
            pass

    return DocumentDetailOut(
        id=doc.id,
        org_id=doc.org_id,
        user_id=doc.user_id,
        filename=doc.filename,
        file_size=doc.file_size,
        mime_type=doc.mime_type,
        format_type=doc.format_type,
        content_hash_sha256=doc.content_hash_sha256,
        version=doc.version,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        digital_twin=twin_obj
    )

@router.get("/{document_id}/download")
async def download_document_file(
    document_id: str,
    request: Request,
    signature: Optional[str] = None,
    expires: Optional[int] = None,
    org_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    target_org_id = None
    caller_user_id = None

    if signature and expires and org_id:
        now_ts = int(time.time())
        if now_ts > expires:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Signed download URL has expired")
        payload = f"{org_id}:{document_id}:{expires}"
        expected_sig = hmac.new(settings.SECRET_KEY.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected_sig, signature):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature in download URL")
        target_org_id = org_id
        caller_user_id = "signed_download"
    else:
        # Standard Bearer auth
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated. Provide Authorization header or valid signed download URL.",
                headers={"WWW-Authenticate": "Bearer"}
            )
        token = auth_header.split(" ", 1)[1]
        current_user = await get_current_user(request=request, token=token, db=db)
        target_org_id = current_user.org_id
        caller_user_id = current_user.id

    stmt = select(Document).where(
        Document.id == document_id,
        Document.org_id == target_org_id
    )
    res = await db.execute(stmt)
    doc = res.scalars().first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    file_bytes = storage_vault.read_file(org_id=target_org_id, storage_path=doc.storage_path)

    audit = AuditEvent(
        org_id=target_org_id,
        user_id=caller_user_id,
        action="DOCUMENT_DOWNLOADED",
        target_type="document",
        target_id=doc.id,
        details_json=json.dumps({"filename": doc.filename}),
        timestamp=datetime.now(timezone.utc).replace(tzinfo=None)
    )
    db.add(audit)
    await db.commit()

    safe_filename = doc.filename.replace("\r", "").replace("\n", "").replace('"', '\\"')
    return Response(
        content=file_bytes,
        media_type=doc.mime_type,
        headers={"Content-Disposition": f'attachment; filename="{safe_filename}"'}
    )

@router.delete("/{document_id}", status_code=status.HTTP_200_OK)
async def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Document).where(
        Document.id == document_id,
        Document.org_id == current_user.org_id
    )
    res = await db.execute(stmt)
    doc = res.scalars().first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    try:
        storage_vault.delete_file(org_id=current_user.org_id, storage_path=doc.storage_path)
    except Exception as cleanup_err:
        logger.warning("Storage file deletion error during document delete: %s", cleanup_err)

    del_org_id = current_user.org_id or doc.org_id
    if not del_org_id:
        del_org_id = await db.scalar(select(Organization.id).limit(1))
    if del_org_id:
        audit = AuditEvent(
            org_id=del_org_id,
            user_id=current_user.id,
            action="DOCUMENT_DELETED",
            target_type="document",
            target_id=doc.id,
            details_json=json.dumps({"filename": doc.filename, "file_size": doc.file_size}),
            timestamp=datetime.now(timezone.utc).replace(tzinfo=None)
        )
        db.add(audit)

    await db.delete(doc)
    await db.commit()

    return {"status": "success", "message": f"Document '{doc.filename}' deleted successfully."}

