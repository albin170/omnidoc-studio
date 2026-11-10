import json
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user import User
from app.models.organization import Organization
from app.models.subscription_management import (
    PlanModel, FeatureModel, SubscriptionModel,
    UserEntitlementOverrideModel, UiConfigurationModel
)

class EffectiveEntitlements:
    def __init__(
        self,
        user_id: str,
        org_id: str,
        plan_slug: str,
        plan_name: str,
        is_active: bool,
        is_suspended: bool,
        enabled_features: List[str],
        disabled_features: List[str],
        storage_quota_bytes: int,
        processing_quota: int,
        ocr_quota: int,
        ai_quota: int,
        workflow_quota: int,
        max_file_size_bytes: int,
        has_api_access: bool,
        support_level: str,
        overrides_applied: Dict[str, Any],
        upload_limit: int = 20
    ):
        self.user_id = user_id
        self.org_id = org_id
        self.plan_slug = plan_slug
        self.plan_name = plan_name
        self.is_active = is_active
        self.is_suspended = is_suspended
        self.enabled_features = enabled_features
        self.disabled_features = disabled_features
        self.storage_quota_bytes = storage_quota_bytes
        self.processing_quota = processing_quota
        self.ocr_quota = ocr_quota
        self.ai_quota = ai_quota
        self.workflow_quota = workflow_quota
        self.max_file_size_bytes = max_file_size_bytes
        self.has_api_access = has_api_access
        self.support_level = support_level
        self.overrides_applied = overrides_applied
        self.upload_limit = upload_limit

    def is_feature_allowed(self, feature_key: str) -> bool:
        if self.is_suspended or not self.is_active:
            return False
        return feature_key in self.enabled_features

    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "org_id": self.org_id,
            "plan_slug": self.plan_slug,
            "plan_name": self.plan_name,
            "is_active": self.is_active,
            "is_suspended": self.is_suspended,
            "enabled_features": self.enabled_features,
            "disabled_features": self.disabled_features,
            "storage_quota_bytes": self.storage_quota_bytes,
            "processing_quota": self.processing_quota,
            "ocr_quota": self.ocr_quota,
            "ai_quota": self.ai_quota,
            "workflow_quota": self.workflow_quota,
            "max_file_size_bytes": self.max_file_size_bytes,
            "upload_limit": self.upload_limit,
            "has_api_access": self.has_api_access,
            "support_level": self.support_level,
            "overrides_applied": self.overrides_applied
        }

async def calculate_user_entitlements(user: User, db: AsyncSession) -> EffectiveEntitlements:
    """
    Entitlement Precedence Calculation:
    1. Platform security rules & Account suspension
    2. Subscription Plan entitlements (via Organization active plan)
    3. Individual User overrides (UserEntitlementOverrideModel)
    """
    # 1. Account status & suspension check
    is_suspended = not user.is_active

    # 2. Query Organization & Plan: Individual user plan strictly takes precedence over org subscription (Section 4, Item 4)
    plan = None
    if user.individual_plan_tier:
        plan = await db.scalar(select(PlanModel).where(PlanModel.slug == user.individual_plan_tier))

    # If no individual plan override, query active organization subscription
    if not plan:
        sub = await db.scalar(
            select(SubscriptionModel)
            .where(SubscriptionModel.org_id == user.org_id, SubscriptionModel.status == "active")
            .order_by(SubscriptionModel.created_at.desc())
        )
        if sub:
            plan = await db.get(PlanModel, sub.plan_id)

    # Fallback to organization plan_tier column
    if not plan:
        org = await db.get(Organization, user.org_id)
        org_tier = org.plan_tier if org else "free"
        plan = await db.scalar(select(PlanModel).where(PlanModel.slug == org_tier))

    if not plan:
        # Fallback to default free plan
        plan = await db.scalar(select(PlanModel).where(PlanModel.is_default == True))

    if not plan:
        # Emergency defaults if database is not seeded
        plan_features = ["pdf_tools", "docx_studio", "sheet_studio", "image_studio", "conversion_hub"]
        storage_quota = 100 * 1024 * 1024
        proc_quota = 50
        ocr_quota = 15
        ai_quota = 10
        wf_quota = 3
        max_size = 25 * 1024 * 1024
        plan_slug = "free"
        plan_name = "Free Community"
        has_api = False
        support_level = "community"
        upload_limit = 20
    else:
        try:
            plan_features = json.loads(plan.features_json)
        except Exception:
            plan_features = []
        storage_quota = plan.storage_quota_bytes
        proc_quota = plan.monthly_processing_quota
        ocr_quota = plan.ocr_quota
        ai_quota = plan.ai_processing_quota
        wf_quota = plan.workflow_quota
        max_size = plan.max_file_size_bytes
        plan_slug = plan.slug
        plan_name = plan.name
        has_api = plan.has_api_access
        support_level = plan.support_level
        upload_limit = getattr(plan, "upload_limit", 20)

    # 3. Query all available system features
    all_features_res = await db.scalars(select(FeatureModel).where(FeatureModel.is_active == True))
    all_feature_keys = [f.feature_key for f in all_features_res.all()]
    if not all_feature_keys:
        all_feature_keys = [
            "pdf_tools", "pdf_sanitizer", "docx_studio", "sheet_studio", "slide_studio",
            "image_studio", "ocr_engine", "conversion_hub", "workflows", "autonomous_agent",
            "document_forensics", "api_access"
        ]

    # Initialize feature set from plan
    enabled_set = set(plan_features)
    overrides_applied = {}

    # 4. Apply Individual User Overrides (Ordered deterministically by creation time and id)
    now = datetime.now(timezone.utc)
    user_overrides = await db.scalars(
        select(UserEntitlementOverrideModel)
        .where(UserEntitlementOverrideModel.user_id == user.id)
        .order_by(UserEntitlementOverrideModel.created_at.asc(), UserEntitlementOverrideModel.id.asc())
    )

    for ov in user_overrides.all():
        # Check expiration
        if ov.expires_at and ov.expires_at.replace(tzinfo=timezone.utc) < now:
            continue

        feat = ov.feature_key
        if ov.is_enabled is True:
            enabled_set.add(feat)
            overrides_applied[f"feature_{feat}"] = "force_enabled"
        elif ov.is_enabled is False:
            enabled_set.discard(feat)
            overrides_applied[f"feature_{feat}"] = "force_disabled"

        # Quotas (validate against invalid negative values)
        if ov.custom_storage_quota_bytes is not None and ov.custom_storage_quota_bytes >= 0:
            storage_quota = ov.custom_storage_quota_bytes
            overrides_applied["storage_quota_bytes"] = storage_quota
        if ov.custom_processing_quota is not None and ov.custom_processing_quota >= 0:
            proc_quota = ov.custom_processing_quota
            overrides_applied["processing_quota"] = proc_quota
        if ov.custom_ocr_quota is not None and ov.custom_ocr_quota >= 0:
            ocr_quota = ov.custom_ocr_quota
            overrides_applied["ocr_quota"] = ocr_quota
        if ov.custom_ai_quota is not None and ov.custom_ai_quota >= 0:
            ai_quota = ov.custom_ai_quota
            overrides_applied["ai_quota"] = ai_quota
        if ov.custom_workflow_quota is not None and ov.custom_workflow_quota >= 0:
            wf_quota = ov.custom_workflow_quota
            overrides_applied["workflow_quota"] = wf_quota
        if ov.custom_max_file_size_bytes is not None and ov.custom_max_file_size_bytes >= 0:
            max_size = ov.custom_max_file_size_bytes
            overrides_applied["max_file_size_bytes"] = max_size

    # If account is suspended, all features are locked
    if is_suspended:
        final_enabled = []
        final_disabled = list(all_feature_keys)
    else:
        final_enabled = [k for k in all_feature_keys if k in enabled_set]
        final_disabled = [k for k in all_feature_keys if k not in enabled_set]

    return EffectiveEntitlements(
        user_id=user.id,
        org_id=user.org_id,
        plan_slug=plan_slug,
        plan_name=plan_name,
        is_active=user.is_active,
        is_suspended=is_suspended,
        enabled_features=final_enabled,
        disabled_features=final_disabled,
        storage_quota_bytes=storage_quota,
        processing_quota=proc_quota,
        ocr_quota=ocr_quota,
        ai_quota=ai_quota,
        workflow_quota=wf_quota,
        max_file_size_bytes=max_size,
        has_api_access=has_api or ("api_access" in final_enabled),
        support_level=support_level,
        overrides_applied=overrides_applied,
        upload_limit=upload_limit
    )

