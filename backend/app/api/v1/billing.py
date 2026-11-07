import json
from typing import Optional, Literal
from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.organization import Organization
from app.models.subscription_management import SubscriptionModel, PlanModel
from app.services.billing_service import billing_service
from app.services.entitlement_service import calculate_user_entitlements

router = APIRouter(prefix="/billing", tags=["Billing & Subscriptions"])

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
    Creates a verified Stripe Checkout session. Never activates paid tiers on button click.
    If Stripe credentials are not configured, returns a clear payment-unavailable message.
    """
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
        cancel_url=payload.cancel_url
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
    """
    sub = await db.scalar(
        select(SubscriptionModel)
        .where(SubscriptionModel.org_id == current_user.org_id, SubscriptionModel.status == "active")
        .order_by(SubscriptionModel.created_at.desc())
    )

    if not sub:
        raise HTTPException(status_code=400, detail="No active subscription found to cancel.")

    sub.cancel_at_period_end = True
    await db.commit()

    return {
        "status": "success",
        "message": "Subscription set to cancel at the end of the current billing period.",
        "effective_date": sub.current_period_end.isoformat() if sub.current_period_end else "immediate"
    }
