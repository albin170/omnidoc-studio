from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.document import Document
from app.models.job import Job
from app.models.organization import Organization
from app.models.subscription_management import SubscriptionModel, PlanModel, UiConfigurationModel
from app.services.entitlement_service import calculate_user_entitlements
import json

router = APIRouter(prefix="/users/me", tags=["User Portal"])

class EntitlementsOut(BaseModel):
    user_id: str
    org_id: str
    plan_slug: str
    plan_name: str
    is_active: bool
    is_suspended: bool
    enabled_features: List[str]
    disabled_features: List[str]
    storage_quota_bytes: int
    processing_quota: int
    ocr_quota: int
    ai_quota: int
    workflow_quota: int
    max_file_size_bytes: int
    has_api_access: bool
    support_level: str
    overrides_applied: Dict[str, Any]

class UserUsageOut(BaseModel):
    storage_used_bytes: int
    storage_quota_bytes: int
    documents_count: int
    jobs_count: int
    recent_jobs: List[Dict[str, Any]]

class UserSubscriptionOut(BaseModel):
    plan_name: str
    plan_slug: str
    status: str
    billing_cycle: str
    monthly_price_cents: int
    support_level: str
    current_period_end: Optional[str]

@router.get("/entitlements", response_model=EntitlementsOut)
async def get_my_effective_entitlements(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns calculated effective entitlements for the logged-in user,
    reflecting their plan plus any individual overrides configured by admin.
    """
    entitlements = await calculate_user_entitlements(current_user, db)
    return EntitlementsOut(**entitlements.to_dict())

@router.get("/usage", response_model=UserUsageOut)
async def get_my_usage_metrics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns real database usage counts for the user's organization.
    """
    ent = await calculate_user_entitlements(current_user, db)
    docs_count = await db.scalar(select(func.count(Document.id)).where(Document.org_id == current_user.org_id)) or 0
    storage_sum = await db.scalar(select(func.sum(Document.file_size)).where(Document.org_id == current_user.org_id)) or 0
    jobs_count = await db.scalar(select(func.count(Job.id)).where(Job.org_id == current_user.org_id)) or 0

    recent_jobs_stmt = select(Job).where(Job.org_id == current_user.org_id).order_by(Job.created_at.desc()).limit(5)
    recent_res = await db.execute(recent_jobs_stmt)
    recent_jobs = [
        {"id": j.id, "type": j.job_type, "status": j.status, "created_at": j.created_at.isoformat()}
        for j in recent_res.scalars().all()
    ]

    return UserUsageOut(
        storage_used_bytes=storage_sum,
        storage_quota_bytes=ent.storage_quota_bytes,
        documents_count=docs_count,
        jobs_count=jobs_count,
        recent_jobs=recent_jobs
    )

@router.get("/subscription", response_model=UserSubscriptionOut)
async def get_my_subscription_details(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns active subscription and plan details for user portal billing view.
    """
    sub = await db.scalar(
        select(SubscriptionModel)
        .where(SubscriptionModel.org_id == current_user.org_id, SubscriptionModel.status == "active")
        .order_by(SubscriptionModel.created_at.desc())
    )

    org = await db.get(Organization, current_user.org_id)
    plan_slug = org.plan_tier if org else "free"
    plan = await db.scalar(select(PlanModel).where(PlanModel.slug == plan_slug))

    return UserSubscriptionOut(
        plan_name=plan.name if plan else "Free Community",
        plan_slug=plan_slug,
        status=sub.status if sub else "active",
        billing_cycle=sub.billing_cycle if sub else "monthly",
        monthly_price_cents=plan.monthly_price_cents if plan else 0,
        support_level=plan.support_level if plan else "community",
        current_period_end=sub.current_period_end.isoformat() if (sub and sub.current_period_end) else None
    )

@router.get("/ui-config")
async def get_user_ui_configuration(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns global UI announcement, maintenance mode, and user-specific module visibility.
    """
    cfg = await db.scalar(select(UiConfigurationModel).where(UiConfigurationModel.scope == "global", UiConfigurationModel.target_id == "all"))
    disabled_modules = []
    announcement = ""
    maintenance = False

    if cfg:
        try:
            disabled_modules = json.loads(cfg.disabled_modules_json)
        except Exception:
            disabled_modules = []
        announcement = cfg.announcement_banner or ""
        maintenance = cfg.maintenance_mode

    # Check individual user UI overrides
    user_ui = await db.scalar(select(UiConfigurationModel).where(UiConfigurationModel.scope == "user", UiConfigurationModel.target_id == current_user.id))
    if user_ui:
        try:
            user_disabled = json.loads(user_ui.disabled_modules_json)
            disabled_modules = list(set(disabled_modules + user_disabled))
        except Exception:
            pass

    return {
        "announcement_banner": announcement,
        "maintenance_mode": maintenance,
        "disabled_modules": disabled_modules
    }
