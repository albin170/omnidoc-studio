import json
from urllib.parse import urlparse
from typing import Optional, Literal
from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.organization import Organization
from app.models.subscription_management import SubscriptionModel, PlanModel
from app.services.billing_service import billing_service
from app.services.entitlement_service import calculate_user_entitlements

router = APIRouter(prefix="/billing", tags=["Billing & Subscriptions"])

def _is_approved_redirect_origin(url: Optional[str]) -> bool:
    if not url:
        return True
    try:
        parsed = urlparse(url)
        if not parsed.netloc: # Relative URLs on the current origin are allowed
            return True
        allowed_hosts = set()
        if settings.FRONTEND_URL:
            allowed_hosts.add(urlparse(settings.FRONTEND_URL).netloc.lower())
        for o in settings.CORS_ORIGINS:
            if o and o != "*":
                allowed_hosts.add(urlparse(o).netloc.lower())
        return parsed.netloc.lower() in allowed_hosts
    except Exception:
        return False

async def _verify_billing_authorization(current_user: User, db: AsyncSession):
    """
    Enforces billing owner or administrator authorization (Section 3.B).
    Ordinary members of an organization cannot modify or cancel billing.
    """
    if current_user.role in ("admin", "superadmin"):
        return
    owner_stmt = select(User.id).where(User.org_id == current_user.org_id).order_by(User.created_at.asc()).limit(1)
    owner_id = await db.scalar(owner_stmt)
    if owner_id and current_user.id != owner_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only the organization billing owner or an administrator can manage subscriptions."
        )

class CheckoutRequest(BaseModel):
    plan_slug: Literal["starter", "pro", "enterprise"]
    billing_interval: Literal["monthly", "annual"] = "monthly"
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None

class CancelSubscriptionRequest(BaseModel):
    reason: Optional[str] = "User requested cancellation"

@router.get("/status")
async def get_billing_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns current organization subscription, active gateway configuration status,
    and upgrade eligibility.
    """
    org = await db.get(Organization, current_user.org_id)
    sub = await db.scalar(
        select(SubscriptionModel)
        .where(SubscriptionModel.org_id == current_user.org_id, SubscriptionModel.status == "active")
        .order_by(SubscriptionModel.created_at.desc())
    )
    plan = await db.scalar(select(PlanModel).where(PlanModel.slug == (org.plan_tier if org else "free")))

    return {
        "org_id": current_user.org_id,
        "plan_tier": org.plan_tier if org else "free",
        "plan_name": plan.name if plan else "Free Community",
        "subscription_status": sub.status if sub else "active",
        "billing_cycle": sub.billing_cycle if sub else "monthly",
        "current_period_end": sub.current_period_end.isoformat() if (sub and sub.current_period_end) else None,
        "payment_gateway_configured": billing_service.is_configured,
        "payment_provider": sub.payment_provider if sub else "manual"
    }

@router.post("/checkout")
async def create_checkout_session(
    payload: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Creates a verified Stripe Checkout session.
    Enforces administrator role check, approved redirect URLs, and authoritative DB prices.
    """
    # Enforce billing owner / administrator authorization (Section 3.B)
    await _verify_billing_authorization(current_user, db)

    # Restrict redirect URLs to approved application origins (Section 3.D)
    if payload.success_url and not _is_approved_redirect_origin(payload.success_url):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Security violation: success_url points to an unauthorized external origin."
        )
    if payload.cancel_url and not _is_approved_redirect_origin(payload.cancel_url):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Security violation: cancel_url points to an unauthorized external origin."
        )

    org = await db.get(Organization, current_user.org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    success, result = await billing_service.create_checkout_session(
        org=org,
        user_email=current_user.email,
        user_id=current_user.id,
        plan_slug=payload.plan_slug,
        billing_interval=payload.billing_interval,
        success_url=payload.success_url,
        cancel_url=payload.cancel_url,
        db=db
    )

    if not success:
        if not billing_service.is_configured:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=result.get("message", "Payment gateway is not currently configured.")
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("detail") or result.get("message") or "Checkout session creation failed."
        )

    return result

@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(None, alias="Stripe-Signature"),
    db: AsyncSession = Depends(get_db)
):
    """
    Listens for verified Stripe webhook events and updates subscription status idempotently.
    Webhooks must have a valid HMAC-SHA256 signature matching STRIPE_WEBHOOK_SECRET.
    """
    payload_bytes = await request.body()

    if not stripe_signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required 'Stripe-Signature' header"
        )

    if not billing_service.verify_webhook_signature(payload_bytes, stripe_signature):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or unverified Stripe webhook signature"
        )

    try:
        event = json.loads(payload_bytes.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Malformed JSON webhook body")

    result = await billing_service.handle_webhook_event(event, db)
    return result

@router.post("/cancel")
async def cancel_subscription(
    payload: CancelSubscriptionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Cancels current active subscription at the end of the billing period.
    Enforces billing-owner authorization and invokes the Stripe API for Stripe-managed subscriptions.
    """
    # Enforce billing-owner authorization (Section 3.B)
    await _verify_billing_authorization(current_user, db)

    sub = await db.scalar(
        select(SubscriptionModel)
        .where(SubscriptionModel.org_id == current_user.org_id, SubscriptionModel.status == "active")
        .order_by(SubscriptionModel.created_at.desc())
    )

    if not sub:
        raise HTTPException(status_code=400, detail="No active subscription found to cancel.")

    # Call Stripe API for Stripe-managed subscriptions before mutating local state (Section 3.A)
    if sub.payment_provider == "stripe" and sub.external_subscription_id:
        stripe_success, stripe_res = await billing_service.cancel_stripe_subscription(
            external_sub_id=sub.external_subscription_id,
            at_period_end=True
        )
        if not stripe_success:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Stripe subscription cancellation failed: {stripe_res.get('error') or stripe_res.get('detail') or 'Unknown Stripe error'}"
            )

    sub.cancel_at_period_end = True
    await db.commit()

    return {
        "status": "success",
        "message": "Subscription set to cancel at the end of the current billing period.",
        "effective_date": sub.current_period_end.isoformat() if sub.current_period_end else "immediate"
    }
