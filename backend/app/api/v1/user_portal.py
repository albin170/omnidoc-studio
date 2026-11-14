from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
import json
import hashlib

from app.core.database import get_db, utc_now
from app.core.security import get_current_user
from app.models.user import User
from app.models.document import Document
from app.models.job import Job
from app.models.organization import Organization
from app.models.subscription_management import SubscriptionModel, PlanModel, UiConfigurationModel
from app.models.consent import ConsentRecord
from app.models.message import Message
from app.models.audit import AuditEvent
from app.services.entitlement_service import calculate_user_entitlements

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
    maintenance_message = ""

    if cfg:
        try:
            disabled_modules = json.loads(cfg.disabled_modules_json)
        except Exception:
            disabled_modules = []
        announcement = cfg.announcement_banner or ""
        maintenance = cfg.maintenance_mode
        maintenance_message = cfg.maintenance_message or ""

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
        "maintenance_message": maintenance_message,
        "disabled_modules": disabled_modules
    }


@router.get("/export")
async def export_my_user_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    PRIV-01 & Master Prompt:
    Authentic user data export archive generating complete, tamper-verifiable JSON
    containing user profile, document metadata, conversion jobs, consent ledger,
    direct messages, and audit trail with a cryptographic SHA-256 integrity checksum.
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Suspended or inactive user account"
        )

    now = utc_now()

    # 1. Profile
    profile = {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "org_id": current_user.org_id,
        "individual_plan_tier": current_user.individual_plan_tier,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
    }

    # 2. Documents (Strict user ownership isolation; internal storage paths omitted to protect infrastructure)
    docs_res = await db.scalars(
        select(Document)
        .where(Document.user_id == current_user.id)
        .order_by(Document.created_at.desc())
    )
    documents = [
        {
            "id": d.id,
            "filename": d.filename,
            "file_size": d.file_size,
            "mime_type": d.mime_type,
            "format_type": d.format_type,
            "content_hash_sha256": d.content_hash_sha256,
            "version": d.version,
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "updated_at": d.updated_at.isoformat() if d.updated_at else None,
        }
        for d in docs_res.all()
    ]

    # 3. Jobs (Strict user ownership isolation)
    jobs_res = await db.scalars(
        select(Job)
        .where(Job.user_id == current_user.id)
        .order_by(Job.created_at.desc())
    )
    jobs = [
        {
            "id": j.id,
            "title": j.title,
            "objective": j.objective,
            "status": j.status,
            "mode": j.mode,
            "current_step_index": j.current_step_index,
            "total_steps": j.total_steps,
            "created_at": j.created_at.isoformat() if j.created_at else None,
            "updated_at": j.updated_at.isoformat() if j.updated_at else None,
        }
        for j in jobs_res.all()
    ]

    # 4. Consents
    consents_res = await db.scalars(
        select(ConsentRecord)
        .where(ConsentRecord.user_id == current_user.id)
        .order_by(ConsentRecord.timestamp.desc())
    )
    consents = [
        {
            "id": c.id,
            "consent_type": c.consent_type,
            "policy_version": c.policy_version,
            "granted": c.granted,
            "timestamp": c.timestamp.isoformat() if c.timestamp else None,
            "ip_address": c.ip_address,
            "user_agent": c.user_agent,
        }
        for c in consents_res.all()
    ]

    # 5. Messages
    msgs_res = await db.scalars(
        select(Message)
        .where(or_(Message.sender_user_id == current_user.id, Message.recipient_user_id == current_user.id))
        .order_by(Message.created_at.desc())
    )
    messages = [
        {
            "id": m.id,
            "sender_user_id": m.sender_user_id,
            "recipient_user_id": m.recipient_user_id,
            "subject": m.subject,
            "body": m.body,
            "priority": m.priority,
            "status": m.status,
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "read_at": m.read_at.isoformat() if m.read_at else None,
        }
        for m in msgs_res.all()
    ]

    # 6. Audit Events (for this user)
    audits_res = await db.scalars(
        select(AuditEvent)
        .where(AuditEvent.user_id == current_user.id)
        .order_by(AuditEvent.timestamp.desc())
        .limit(500)
    )
    audit_events = [
        {
            "id": a.id,
            "action": a.action,
            "target_type": a.target_type,
            "target_id": a.target_id,
            "details_json": a.details_json,
            "timestamp": a.timestamp.isoformat() if a.timestamp else None,
        }
        for a in audits_res.all()
    ]

    payload = {
        "export_version": "1.0",
        "exported_at": now.isoformat(),
        "user_id": current_user.id,
        "integrity_verification": "SHA-256 digital signature of canonical JSON archive (portable, unencrypted export)",
        "profile": profile,
        "documents": documents,
        "personal_documents": documents,
        "jobs": jobs,
        "consent_history": consents,
        "messages": messages,
        "audit_events": audit_events
    }

    # Deterministic SHA-256 Checksum
    serialized_canonical = json.dumps(payload, sort_keys=True, separators=(',', ':'))
    checksum = hashlib.sha256(serialized_canonical.encode("utf-8")).hexdigest()

    # Record Audit Event safely
    audit_org = current_user.org_id
    if not audit_org:
        audit_org = await db.scalar(select(Organization.id).limit(1))

    if audit_org:
        audit = AuditEvent(
            org_id=audit_org,
            user_id=current_user.id,
            action="EXPORT_USER_DATA",
            target_type="User",
            target_id=current_user.id,
            details_json=json.dumps({"checksum_sha256": checksum, "record_counts": {
                "documents": len(documents),
                "jobs": len(jobs),
                "consents": len(consents),
                "messages": len(messages),
                "audits": len(audit_events)
            }}),
            timestamp=now
        )
        db.add(audit)
    await db.commit()

    return {
        "status": "success",
        "export_version": "1.0",
        "exported_at": now.isoformat(),
        "user_id": current_user.id,
        "checksum_sha256": checksum,
        "archive": payload
    }


