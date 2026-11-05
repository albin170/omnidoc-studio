from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.document import Document
from app.schemas.digital_twin import DocumentDigitalTwin

router = APIRouter(prefix="/simulate", tags=["Document What-If Simulator"])

class SimulationRequest(BaseModel):
    document_id: str
    font_size_delta_pt: Optional[float] = 0.0 # e.g. -2.0 (shrink) or +2.0 (enlarge)
    remove_columns_count: Optional[int] = 0
    translation_target_lang: Optional[str] = None # e.g. "de" (+30% text expansion)
    target_page_limit: Optional[int] = None

class SimulationResponse(BaseModel):
    document_id: str
    is_simulation: bool = True
    original_page_count: int
    predicted_page_count: int
    page_delta: int
    predicted_overflow: bool
    text_expansion_ratio: float
    table_compression_ratio: float
    warnings: List[str]
    recommendations: List[str]

@router.post("", response_model=SimulationResponse)
async def simulate_document_modifications(
    req: SimulationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Document).where(Document.id == req.document_id, Document.org_id == current_user.org_id)
    res = await db.execute(stmt)
    doc = res.scalars().first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    orig_pages = 1
    total_words = 200
    if doc.digital_twin_json:
        twin = DocumentDigitalTwin.model_validate_json(doc.digital_twin_json)
        orig_pages = max(1, len(twin.pages) or twin.metadata.page_count)
        total_words = sum(len(p.text.split()) for p in twin.paragraphs) or 200

    # Calculate translation expansion factor
    expansion_factor = 1.0
    if req.translation_target_lang:
        lang = req.translation_target_lang.lower()
        if lang in ("de", "german", "es", "spanish", "fr", "french"):
            expansion_factor = 1.28
        elif lang in ("ru", "russian", "pt", "portuguese"):
            expansion_factor = 1.20
        else:
            expansion_factor = 1.10

    # Calculate font scaling factor (approx 8.3% per point change)
    font_factor = 1.0 + ((req.font_size_delta_pt or 0.0) * 0.083)

    # Combined volume multiplier
    combined_multiplier = expansion_factor * font_factor
    predicted_pages = max(1, round(orig_pages * combined_multiplier))
    
    warnings: List[str] = []
    recommendations: List[str] = []

    if combined_multiplier > 1.25:
        warnings.append("High risk of text overflow into downstream sections and header displacement.")
        recommendations.append("Consider reducing font size by 1.5pt or adjusting line spacing to 1.15 to maintain original pagination.")

    if req.target_page_limit and predicted_pages > req.target_page_limit:
        warnings.append(f"Predicted page count ({predicted_pages}) exceeds target ceiling of {req.target_page_limit} pages.")
        recommendations.append(f"Apply a font scale delta of -{(predicted_pages - req.target_page_limit) * 1.2:.1f}pt to fit within {req.target_page_limit} pages.")

    if req.remove_columns_count and req.remove_columns_count > 0:
        recommendations.append(f"Removing {req.remove_columns_count} table columns frees ~{req.remove_columns_count * 14}% horizontal width.")

    return SimulationResponse(
        document_id=doc.id,
        is_simulation=True,
        original_page_count=orig_pages,
        predicted_page_count=predicted_pages,
        page_delta=predicted_pages - orig_pages,
        predicted_overflow=predicted_pages > orig_pages,
        text_expansion_ratio=round(combined_multiplier, 3),
        table_compression_ratio=1.0 - (0.12 * (req.remove_columns_count or 0)),
        warnings=warnings,
        recommendations=recommendations
    )
