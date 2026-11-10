import os
import time
import json
import hmac
import hashlib
import logging
import httpx
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.models.organization import Organization
from app.models.subscription_management import SubscriptionModel, PlanModel
from app.models.workflow import IdempotencyRecordModel
from app.models.audit import AuditEvent

logger = logging.getLogger("omnidoc.billing")

class BillingService:
    def __init__(self):
        self.secret_key = settings.STRIPE_SECRET_KEY
        self.webhook_secret = settings.STRIPE_WEBHOOK_SECRET
        self.stripe_api_base = "https://api.stripe.com/v1"

    @property
    def is_configured(self) -> bool:
        return bool(self.secret_key and self.secret_key.startswith("sk_"))

    async def create_checkout_session(
        self,
        org: Organization,
        user_email: str,
        user_id: str,
        plan_slug: str,
        billing_interval: str = "monthly",
        success_url: Optional[str] = None,
        cancel_url: Optional[str] = None,
        db: Optional[AsyncSession] = None
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Creates a real Stripe Checkout Session for subscription upgrade using authoritative plan prices.
        Returns (success, response_dict).
        """
        if not self.is_configured:
            return False, {
                "error": "Payment gateway not configured",
                "message": "Stripe payment gateway credentials are not configured. To activate paid tiers, please contact enterprise billing at sales@omnidoc.studio."
            }

        success_url = success_url or f"{settings.FRONTEND_URL}/#dashboard?checkout=success"
        cancel_url = cancel_url or f"{settings.FRONTEND_URL}/#pricing?checkout=canceled"

        # Authoritative Plan price lookup from database if session is provided
        plan = None
        if db:
            plan = await db.scalar(select(PlanModel).where(PlanModel.slug == plan_slug, PlanModel.is_active == True))

        if plan:
            plan_name = plan.name
            unit_amount = plan.annual_price_cents if billing_interval == "annual" else plan.monthly_price_cents
        else:
            # Fallback to configured plan catalog defaults
            catalog = {
                "starter": {"monthly": 1900, "annual": 19000, "name": "Starter Pro"},
                "pro": {"monthly": 4900, "annual": 49000, "name": "Professional Suite"},
                "enterprise": {"monthly": 19900, "annual": 199000, "name": "Enterprise Cloud"},
            }
            plan_info = catalog.get(plan_slug)
            if not plan_info:
                return False, {"error": "Invalid plan", "message": f"Plan '{plan_slug}' is not recognized."}
            plan_name = plan_info["name"]
            unit_amount = plan_info["annual"] if billing_interval == "annual" else plan_info["monthly"]

        interval = "year" if billing_interval == "annual" else "month"

        data = {
            "mode": "subscription",
            "payment_method_types[0]": "card",
            "line_items[0][price_data][currency]": "usd",
            "line_items[0][price_data][product_data][name]": f"OmniDoc Studio — {plan_name}",
            "line_items[0][price_data][unit_amount]": str(unit_amount),
            "line_items[0][price_data][recurring][interval]": interval,
            "line_items[0][quantity]": "1",
            "customer_email": user_email,
            "success_url": success_url,
            "cancel_url": cancel_url,
            # Attach metadata to Checkout Session
            "metadata[org_id]": org.id,
            "metadata[user_id]": user_id,
            "metadata[plan_slug]": plan_slug,
            "metadata[billing_interval]": billing_interval,
            # Attach metadata directly to resulting Stripe Subscription (Section 3.C)
            "subscription_data[metadata][org_id]": org.id,
            "subscription_data[metadata][user_id]": user_id,
            "subscription_data[metadata][plan_slug]": plan_slug,
            "subscription_data[metadata][billing_interval]": billing_interval,
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(
                    f"{self.stripe_api_base}/checkout/sessions",
                    headers={
                        "Authorization": f"Bearer {self.secret_key}",
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    data=data
                )

                if res.status_code != 200:
                    logger.error("Stripe checkout creation failed: %s %s", res.status_code, res.text)
                    return False, {"error": "Stripe API error", "detail": res.text}

                session_data = res.json()
                return True, {
                    "checkout_url": session_data.get("url"),
                    "session_id": session_data.get("id"),
                    "plan_slug": plan_slug,
                    "billing_interval": billing_interval
                }
        except Exception as e:
            logger.error("Exception during checkout session creation: %s", e)
            return False, {"error": "Checkout connection error", "detail": str(e)}

    async def cancel_stripe_subscription(self, external_sub_id: str, at_period_end: bool = True) -> Tuple[bool, Dict[str, Any]]:
        """
        Calls Stripe API to cancel a subscription at period end or immediately.
        """
        if not self.is_configured:
            return False, {"error": "Payment gateway not configured"}

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(
                    f"{self.stripe_api_base}/subscriptions/{external_sub_id}",
                    headers={
                        "Authorization": f"Bearer {self.secret_key}",
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    data={"cancel_at_period_end": "true" if at_period_end else "false"}
                )
                if res.status_code != 200:
                    logger.error("Stripe subscription cancellation failed: %s %s", res.status_code, res.text)
                    return False, {"error": "Stripe API error", "detail": res.text}
                return True, res.json()
        except Exception as e:
            logger.error("Stripe cancellation request failed: %s", e)
            return False, {"error": "Stripe connection error", "detail": str(e)}

    def verify_webhook_signature(self, payload_bytes: bytes, sig_header: str) -> bool:
        """
        Cryptographically verifies Stripe webhook signature using HMAC-SHA256.
        """
        if not self.webhook_secret:
            return False

        try:
            items = dict(item.strip().split("=", 1) for item in sig_header.split(","))
            timestamp = items.get("t")
            v1_sig = items.get("v1")

            if not timestamp or not v1_sig:
                return False

            # Check timestamp tolerance (5 minutes)
            if abs(time.time() - int(timestamp)) > 300:
                return False

            signed_payload = f"{timestamp}.".encode("utf-8") + payload_bytes
            expected_sig = hmac.new(
                self.webhook_secret.encode("utf-8"),
                signed_payload,
                hashlib.sha256
            ).hexdigest()

            return hmac.compare_digest(expected_sig, v1_sig)
        except Exception as e:
            logger.warning("Stripe webhook signature verification failed: %s", e)
            return False

    async def handle_webhook_event(
        self,
        event: Dict[str, Any],
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        Processes verified Stripe webhook event idempotently.
        """
        event_id = event.get("id")
        event_type = event.get("type")

        if not event_id:
            return {"status": "ignored", "reason": "Missing event id"}

        # Idempotency check
        existing_idempotency = await db.get(IdempotencyRecordModel, f"stripe_{event_id}")
        if existing_idempotency:
            return {"status": "idempotent_skip", "event_id": event_id}

        data_obj = event.get("data", {}).get("object", {})

        if event_type in ("checkout.session.completed", "customer.subscription.created", "customer.subscription.updated"):
            metadata = data_obj.get("metadata", {})
            org_id = metadata.get("org_id")
            plan_slug = metadata.get("plan_slug")
            billing_interval = metadata.get("billing_interval", "monthly")
            user_id = metadata.get("user_id")
            ext_sub_id = data_obj.get("subscription") or (data_obj.get("id") if "sub_" in str(data_obj.get("id")) else None)

            # If metadata was not on the event object directly, try to resolve via existing subscription record
            if not org_id and ext_sub_id:
                existing_sub = await db.scalar(
                    select(SubscriptionModel).where(SubscriptionModel.external_subscription_id == ext_sub_id)
                )
                if existing_sub:
                    org_id = existing_sub.org_id
                    if not plan_slug:
                        existing_plan = await db.get(PlanModel, existing_sub.plan_id)
                        if existing_plan:
                            plan_slug = existing_plan.slug

            if org_id and plan_slug:
                org = await db.get(Organization, org_id)
                if org:
                    org.plan_tier = plan_slug

                    plan = await db.scalar(select(PlanModel).where(PlanModel.slug == plan_slug))
                    if plan:
                        sub = await db.scalar(
                            select(SubscriptionModel)
                            .where(SubscriptionModel.org_id == org_id, SubscriptionModel.status == "active")
                        )
                        now = datetime.now(timezone.utc)
                        # Use actual Stripe period timestamps from the webhook event (Section 3.C)
                        start_ts = data_obj.get("current_period_start")
                        end_ts = data_obj.get("current_period_end")
                        period_start = datetime.fromtimestamp(start_ts, tz=timezone.utc) if start_ts else now
                        period_end = datetime.fromtimestamp(end_ts, tz=timezone.utc) if end_ts else now + (timedelta(days=365) if billing_interval == "annual" else timedelta(days=30))

                        if sub:
                            sub.plan_id = plan.id
                            sub.billing_cycle = billing_interval
                            sub.current_period_start = period_start
                            sub.current_period_end = period_end
                            sub.payment_provider = "stripe"
                            if ext_sub_id:
                                sub.external_subscription_id = ext_sub_id
                        else:
                            new_sub = SubscriptionModel(
                                org_id=org.id,
                                user_id=user_id,
                                plan_id=plan.id,
                                status="active",
                                billing_cycle=billing_interval,
                                current_period_start=period_start,
                                current_period_end=period_end,
                                payment_provider="stripe",
                                external_subscription_id=ext_sub_id
                            )
                            db.add(new_sub)

                    audit = AuditEvent(
                        org_id=org.id,
                        user_id=user_id or "system",
                        action="BILLING_SUBSCRIPTION_ACTIVATED",
                        target_type="organization",
                        target_id=org.id,
                        details_json=json.dumps({"plan_slug": plan_slug, "billing_interval": billing_interval, "event_id": event_id}),
                        timestamp=datetime.now(timezone.utc)
                    )
                    db.add(audit)

        elif event_type == "customer.subscription.deleted":
            sub_id = data_obj.get("id")
            if sub_id:
                sub = await db.scalar(select(SubscriptionModel).where(SubscriptionModel.external_subscription_id == sub_id))
                if sub:
                    sub.status = "canceled"
                    org = await db.get(Organization, sub.org_id)
                    if org:
                        org.plan_tier = "free"
                    audit = AuditEvent(
                        org_id=sub.org_id,
                        user_id="system",
                        action="BILLING_SUBSCRIPTION_CANCELED",
                        target_type="subscription",
                        target_id=sub.id,
                        details_json=json.dumps({"event_id": event_id, "external_subscription_id": sub_id}),
                        timestamp=datetime.now(timezone.utc)
                    )
                    db.add(audit)

        elif event_type == "invoice.payment_failed":
            sub_id = data_obj.get("subscription")
            if sub_id:
                sub = await db.scalar(select(SubscriptionModel).where(SubscriptionModel.external_subscription_id == sub_id))
                if sub:
                    sub.status = "past_due"
                    audit = AuditEvent(
                        org_id=sub.org_id,
                        user_id="system",
                        action="BILLING_PAYMENT_FAILED",
                        target_type="subscription",
                        target_id=sub.id,
                        details_json=json.dumps({"event_id": event_id, "external_subscription_id": sub_id}),
                        timestamp=datetime.now(timezone.utc)
                    )
                    db.add(audit)

        # Mark event processed
        try:
            db.add(IdempotencyRecordModel(
                key=f"stripe_{event_id}",
                result_json=f'{{"status": "processed", "type": "{event_type}"}}'
            ))
            await db.commit()
        except Exception as e:
            await db.rollback()
            # If concurrent duplicate delivery caused a database unique constraint conflict, return idempotent skip
            if "unique" in str(e).lower() or "integrity" in str(e).lower() or "duplicate" in str(e).lower():
                return {"status": "idempotent_skip", "event_id": event_id}
            logger.error("Failed to record Stripe webhook idempotency for event %s: %s", event_id, e)
            raise e

        return {"status": "success", "event_id": event_id, "type": event_type}

billing_service = BillingService()
