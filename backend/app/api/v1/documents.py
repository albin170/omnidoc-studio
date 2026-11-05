import os
import uuid
from typing import List
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.document import Document
from app.schemas.document import DocumentOut, DocumentDetailOut
from app.schemas.digital_twin import DocumentDigitalTwin
from app.services.storage import storage_vault
from app.services.parser import document_parser

router = APIRouter(prefix="/documents", tags=["Documents"])

@router.post("/upload", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    filename = file.filename or "uploaded_file"
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported format '{ext}'. Allowed: {sorted(list(settings.ALLOWED_EXTENSIONS))}"
        )

    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 50MB storage limit"
        )

    doc_id = str(uuid.uuid4())
    storage_path, content_hash, file_size = await storage_vault.save_file(
        org_id=current_user.org_id,
        document_id=doc_id,
        filename=filename,
        content=content
    )

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
    await db.commit()
    await db.refresh(new_doc)

    return new_doc

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

    file_bytes = storage_vault.read_file(org_id=current_user.org_id, storage_path=doc.storage_path)
    return Response(
        content=file_bytes,
        media_type=doc.mime_type,
        headers={"Content-Disposition": f'attachment; filename="{doc.filename}"'}
    )

