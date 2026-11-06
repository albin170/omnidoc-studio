import json
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.subscription_management import PlanModel, FeatureModel

router = APIRouter(prefix="/plans", tags=["Subscription Plans"])

class PlanPublicOut(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str]
    monthly_price_cents: int
    annual_price_cents: int
    currency: str
    billing_interval: str
    is_default: bool
    display_order: int
    upload_limit: int
    max_file_size_bytes: int
    storage_quota_bytes: int
    monthly_processing_quota: int
    ocr_quota: int
    ai_processing_quota: int
    workflow_quota: int
    has_api_access: bool
    support_level: str
    features: List[str]

@router.get("", response_model=List[PlanPublicOut])
async def list_published_plans(db: AsyncSession = Depends(get_db)):
    """
    Public pricing page endpoint: returns all active plans ordered by display_order.
    """
    stmt = (
        select(PlanModel)
        .where(PlanModel.is_active == True)
        .order_by(PlanModel.display_order.asc())
    )
    res = await db.execute(stmt)
    plans = res.scalars().all()

    out = []
    for p in plans:
        try:
            feats = json.loads(p.features_json)
        except Exception:
            feats = []
        out.append(PlanPublicOut(
            id=p.id,
            name=p.name,
            slug=p.slug,
            description=p.description,
            monthly_price_cents=p.monthly_price_cents,
            annual_price_cents=p.annual_price_cents,
            currency=p.currency,
            billing_interval=p.billing_interval,
            is_default=p.is_default,
            display_order=p.display_order,
            upload_limit=p.upload_limit,
            max_file_size_bytes=p.max_file_size_bytes,
            storage_quota_bytes=p.storage_quota_bytes,
            monthly_processing_quota=p.monthly_processing_quota,
            ocr_quota=p.ocr_quota,
            ai_processing_quota=p.ai_processing_quota,
            workflow_quota=p.workflow_quota,
            has_api_access=p.has_api_access,
            support_level=p.support_level,
            features=feats
        ))
    return out

