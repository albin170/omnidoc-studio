from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.document import Document
from app.schemas.digital_twin import DocumentDigitalTwin
from app.services.search import semantic_search_service

router = APIRouter(prefix="/search", tags=["Search & Q&A"])

class SearchQueryRequest(BaseModel):
    query: str
    top_k: int = 5
    document_ids: Optional[List[str]] = None

class SearchResultItem(BaseModel):
    document_id: str
    filename: str
    page_number: int
    matched_text: str
    score: float
    context: str

class QARequest(BaseModel):
    question: str
    document_ids: Optional[List[str]] = None

class QAResponse(BaseModel):
    question: str
    answer: str
    confidence: float
    evidence_found: bool
    citations: List[SearchResultItem]

@router.post("", response_model=List[SearchResultItem])
async def search_documents(
    req: SearchQueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Document).where(Document.org_id == current_user.org_id)
    if req.document_ids:
        stmt = stmt.where(Document.id.in_(req.document_ids))
    res = await db.execute(stmt)
    docs = res.scalars().all()

    twins: List[DocumentDigitalTwin] = []
    for d in docs:
        if d.digital_twin_json:
            twins.append(DocumentDigitalTwin.model_validate_json(d.digital_twin_json))

    result = semantic_search_service.search_documents(twins, req.query, limit=req.top_k)
    return [
        SearchResultItem(
            document_id=h.document_id,
            filename=h.filename,
            page_number=h.page_number,
            matched_text=h.matched_text,
            score=h.score,
            context=h.context_snippet
        )
        for h in result.matches
    ]

@router.post("/ask", response_model=QAResponse)
async def ask_document_corpus(
    req: QARequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Document).where(Document.org_id == current_user.org_id)
    if req.document_ids:
        stmt = stmt.where(Document.id.in_(req.document_ids))
    res = await db.execute(stmt)
    docs = res.scalars().all()

    twins: List[DocumentDigitalTwin] = []
    for d in docs:
        if d.digital_twin_json:
            twins.append(DocumentDigitalTwin.model_validate_json(d.digital_twin_json))

    result = semantic_search_service.search_documents(twins, req.question, limit=3)
    if not result.matches or result.matches[0].score < 0.2:
        return QAResponse(
            question=req.question,
            answer="No verifiable evidence matching this query was located in the tenant document corpus.",
            confidence=0.0,
            evidence_found=False,
            citations=[]
        )

    citations = [
        SearchResultItem(
            document_id=h.document_id,
            filename=h.filename,
            page_number=h.page_number,
            matched_text=h.matched_text,
            score=h.score,
            context=h.context_snippet
        )
        for h in result.matches
    ]

    best = result.matches[0]
    answer = f"Based on {best.filename} (Page {best.page_number}): \"{best.matched_text}\"."

    return QAResponse(
        question=req.question,
        answer=answer,
        confidence=best.score,
        evidence_found=True,
        citations=citations
    )
