import pytest
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.organization import Organization
from app.core.security import get_password_hash, create_access_token


@pytest.mark.asyncio
async def test_direct_messaging_and_announcements_lifecycle(client: AsyncClient, db_session: AsyncSession):
    # 1. Setup Organization
    org = Organization(name="Communication Test Org", slug="comm-test-org", plan_tier="free")
    db_session.add(org)
    await db_session.flush()

    # 2. Setup Superadmin, Admin, and two standard users
    admin_user = User(
        email="admin@omnidoc.io",
        hashed_password=get_password_hash("AdminPass123!"),
        full_name="Admin Chief",
        role="admin",
        is_active=True,
        terms_accepted=True,
        privacy_accepted=True,
        ai_consent=True,
        org_id=org.id
    )
    user_a = User(
        email="usera@omnidoc.io",
        hashed_password=get_password_hash("UserAPass123!"),
        full_name="Alice User",
        role="user",
        individual_plan_tier="pro",
        is_active=True,
        terms_accepted=True,
        privacy_accepted=True,
        ai_consent=True,
        org_id=org.id
    )
    user_b = User(
        email="userb@omnidoc.io",
        hashed_password=get_password_hash("UserBPass123!"),
        full_name="Bob User",
        role="user",
        individual_plan_tier="free",
        is_active=True,
        terms_accepted=True,
        privacy_accepted=True,
        ai_consent=True,
        org_id=org.id
    )
    db_session.add_all([admin_user, user_a, user_b])
    await db_session.commit()
    await db_session.refresh(admin_user)
    await db_session.refresh(user_a)
    await db_session.refresh(user_b)

    admin_token = create_access_token({"sub": admin_user.id, "email": admin_user.email, "role": "admin"})
    user_a_token = create_access_token({"sub": user_a.id, "email": user_a.email, "role": "user"})
    user_b_token = create_access_token({"sub": user_b.id, "email": user_b.email, "role": "user"})

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    user_a_headers = {"Authorization": f"Bearer {user_a_token}"}
    user_b_headers = {"Authorization": f"Bearer {user_b_token}"}

    # =========================================================================
    # PART 1: DIRECT MESSAGING
    # =========================================================================

    # Test 1: Standard user CANNOT send direct messages via /messages/send (403)
    res = await client.post(
        "/api/v1/messages/send",
        headers=user_a_headers,
        json={
            "recipient_user_id": user_b.id,
            "subject": "Unauthorized admin msg",
            "body": "This should fail",
            "priority": "normal"
        }
    )
    assert res.status_code == 403

    # Test 2: Admin sends direct message to User A (201 Created)
    msg_payload = {
        "recipient_user_id": user_a.id,
        "subject": "Account Quota Upgrade Notice",
        "body": "Your high-capacity processing quota has been provisioned.",
        "priority": "important"
    }
    res = await client.post("/api/v1/messages/send", headers=admin_headers, json=msg_payload)
    assert res.status_code == 201
    msg_data = res.json()
    assert msg_data["subject"] == msg_payload["subject"]
    assert msg_data["recipient_user_id"] == user_a.id
    assert msg_data["sender_user_id"] == admin_user.id
    assert msg_data["status"] == "sent"
    message_id = msg_data["id"]

    # Test 3: User A checks inbox (should have 1 unread message)
    res_inbox_a = await client.get("/api/v1/messages/inbox", headers=user_a_headers)
    assert res_inbox_a.status_code == 200
    inbox_a_data = res_inbox_a.json()
    assert inbox_a_data["total"] == 1
    assert inbox_a_data["unread_count"] == 1
    assert inbox_a_data["items"][0]["id"] == message_id

    # Test 4: User B checks inbox (should be strictly isolated, 0 messages)
    res_inbox_b = await client.get("/api/v1/messages/inbox", headers=user_b_headers)
    assert res_inbox_b.status_code == 200
    inbox_b_data = res_inbox_b.json()
    assert inbox_b_data["total"] == 0
    assert inbox_b_data["unread_count"] == 0

    # Test 5: User B cannot fetch User A's message by ID (403 Forbidden)
    res_unauth_msg = await client.get(f"/api/v1/messages/{message_id}", headers=user_b_headers)
    assert res_unauth_msg.status_code == 403

    # Test 6: User A marks message as read
    res_read = await client.patch(f"/api/v1/messages/{message_id}/read", headers=user_a_headers)
    assert res_read.status_code == 200
    assert res_read.json()["read_at"] is not None

    # Check unread count is now 0
    res_inbox_a_updated = await client.get("/api/v1/messages/inbox", headers=user_a_headers)
    assert res_inbox_a_updated.json()["unread_count"] == 0

    # Test 7: User A replies to the message
    res_reply = await client.post(
        f"/api/v1/messages/{message_id}/reply",
        headers=user_a_headers,
        json={"body": "Thank you, confirmed received."}
    )
    assert res_reply.status_code == 201
    reply_data = res_reply.json()
    assert reply_data["subject"] == "Re: Account Quota Upgrade Notice"
    assert reply_data["sender_user_id"] == user_a.id
    assert reply_data["recipient_user_id"] == admin_user.id

    # Test 8: Admin checks message history
    res_admin_hist = await client.get("/api/v1/messages/admin/history", headers=admin_headers)
    assert res_admin_hist.status_code == 200
    assert res_admin_hist.json()["total"] >= 1

    # Test 9: User A archives message -> hidden from default inbox
    res_arch = await client.patch(f"/api/v1/messages/{message_id}/archive", headers=user_a_headers)
    assert res_arch.status_code == 200
    assert res_arch.json()["status"] == "archived"

    res_inbox_after_arch = await client.get("/api/v1/messages/inbox", headers=user_a_headers)
    assert res_inbox_after_arch.json()["total"] == 0

    # If include_archived=true, it is returned
    res_inbox_with_arch = await client.get("/api/v1/messages/inbox?include_archived=true", headers=user_a_headers)
    assert res_inbox_with_arch.json()["total"] == 1

    # =========================================================================
    # PART 2: ANNOUNCEMENTS
    # =========================================================================

    # Test 10: Standard user CANNOT create announcement (403)
    res_unauth_ann = await client.post(
        "/api/v1/announcements",
        headers=user_a_headers,
        json={"title": "Hacked", "body": "Unauthorized announcement"}
    )
    assert res_unauth_ann.status_code == 403

    # Test 11: Admin creates global informational announcement
    res_ann1 = await client.post(
        "/api/v1/announcements",
        headers=admin_headers,
        json={
            "title": "Scheduled Maintenance Window",
            "body": "System updates scheduled for Sunday at 02:00 UTC.",
            "priority": "informational",
            "audience_type": "all",
            "is_published": True
        }
    )
    assert res_ann1.status_code == 201
    ann1_id = res_ann1.json()["id"]

    # Test 12: Admin creates targeted announcement for "pro" plan users only
    res_ann_pro = await client.post(
        "/api/v1/announcements",
        headers=admin_headers,
        json={
            "title": "Pro Tier Feature Preview",
            "body": "New batch OCR pipeline is now in beta for Pro users.",
            "priority": "important",
            "audience_type": "plan",
            "audience_reference": "pro",
            "is_published": True
        }
    )
    assert res_ann_pro.status_code == 201
    ann_pro_id = res_ann_pro.json()["id"]

    # Test 13: Admin creates critical announcement
    res_ann_crit = await client.post(
        "/api/v1/announcements",
        headers=admin_headers,
        json={
            "title": "Urgent Security Certificate Rotation",
            "body": "All API clients must verify updated TLS 1.3 certificates.",
            "priority": "critical",
            "audience_type": "all",
            "is_published": True
        }
    )
    assert res_ann_crit.status_code == 201
    ann_crit_id = res_ann_crit.json()["id"]

    # Test 14: User A (Pro tier) views active announcements
    # Should see: global maintenance, pro feature preview, and critical cert rotation (3 announcements)
    res_active_a = await client.get("/api/v1/announcements/active", headers=user_a_headers)
    assert res_active_a.status_code == 200
    active_a = res_active_a.json()
    assert active_a["total"] == 3
    # Check critical is first in order
    assert active_a["items"][0]["priority"] == "critical"

    # Test 15: User B (Free tier) views active announcements
    # Should see: global maintenance and critical cert rotation (2 announcements, NOT the pro one)
    res_active_b = await client.get("/api/v1/announcements/active", headers=user_b_headers)
    assert res_active_b.status_code == 200
    active_b = res_active_b.json()
    assert active_b["total"] == 2
    b_ids = [item["id"] for item in active_b["items"]]
    assert ann1_id in b_ids
    assert ann_crit_id in b_ids
    assert ann_pro_id not in b_ids

    # Test 16: User A marks announcement as read
    res_ann_read = await client.post(f"/api/v1/announcements/{ann1_id}/read", headers=user_a_headers)
    assert res_ann_read.status_code == 200

    # User A checks active announcements again; ann1 should be marked is_read=True
    res_active_a2 = await client.get("/api/v1/announcements/active", headers=user_a_headers)
    item_ann1 = next(item for item in res_active_a2.json()["items"] if item["id"] == ann1_id)
    assert item_ann1["is_read"] is True

    # Test 17: User A dismisses informational announcement -> hidden from active unless requested
    res_diss = await client.post(f"/api/v1/announcements/{ann1_id}/dismiss", headers=user_a_headers)
    assert res_diss.status_code == 200

    res_active_a3 = await client.get("/api/v1/announcements/active", headers=user_a_headers)
    active_ids_after_diss = [item["id"] for item in res_active_a3.json()["items"]]
    assert ann1_id not in active_ids_after_diss

    # Test 18: Critical announcement CANNOT be dismissed (400 Bad Request)
    res_crit_diss = await client.post(f"/api/v1/announcements/{ann_crit_id}/dismiss", headers=user_a_headers)
    assert res_crit_diss.status_code == 400
    assert "Critical announcements cannot be dismissed" in res_crit_diss.json()["detail"]

    # Test 19: Admin lists all announcements and verifies readership
    res_admin_anns = await client.get("/api/v1/announcements/admin", headers=admin_headers)
    assert res_admin_anns.status_code == 200
    assert res_admin_anns.json()["total"] == 3

    # Test 20: Admin archives an announcement
    res_arch_ann = await client.delete(f"/api/v1/announcements/{ann_crit_id}", headers=admin_headers)
    assert res_arch_ann.status_code == 200
    assert res_arch_ann.json()["status"] == "archived"


@pytest.mark.asyncio
async def test_announcement_effective_plan_scheduling_and_suspension(client: AsyncClient, db_session: AsyncSession):
    """
    Test Phase 3 requirements:
    1. Organization plan inheritance for users without individual overrides
    2. Individual plan overrides taking strict precedence over org plan
    3. Future-scheduled announcements are hidden until published_at
    4. Inactive/suspended users are denied with 403 Forbidden
    """
    # 1. Pro Organization
    pro_org = Organization(name="Pro Enterprise Corp", slug="pro-corp", plan_tier="pro")
    db_session.add(pro_org)
    await db_session.flush()

    admin = User(
        email="admin_sched@omnidoc.io",
        hashed_password=get_password_hash("AdminPass123!"),
        full_name="Admin Scheduler",
        role="admin",
        is_active=True,
        org_id=pro_org.id
    )
    # User C has NO individual override -> should inherit "pro" from pro_org
    user_c = User(
        email="user_c@omnidoc.io",
        hashed_password=get_password_hash("UserPass123!"),
        full_name="User C Inherited Pro",
        role="user",
        individual_plan_tier=None,
        is_active=True,
        org_id=pro_org.id
    )
    # User D is in pro_org but has individual override "free" -> should resolve to "free"
    user_d = User(
        email="user_d@omnidoc.io",
        hashed_password=get_password_hash("UserPass123!"),
        full_name="User D Override Free",
        role="user",
        individual_plan_tier="free",
        is_active=True,
        org_id=pro_org.id
    )
    # User E is suspended / inactive
    user_e = User(
        email="user_e@omnidoc.io",
        hashed_password=get_password_hash("UserPass123!"),
        full_name="User E Suspended",
        role="user",
        is_active=False,
        org_id=pro_org.id
    )
    db_session.add_all([admin, user_c, user_d, user_e])
    await db_session.commit()

    admin_token = create_access_token({"sub": admin.id, "email": admin.email, "role": "admin"})
    user_c_token = create_access_token({"sub": user_c.id, "email": user_c.email, "role": "user"})
    user_d_token = create_access_token({"sub": user_d.id, "email": user_d.email, "role": "user"})
    user_e_token = create_access_token({"sub": user_e.id, "email": user_e.email, "role": "user"})

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    user_c_headers = {"Authorization": f"Bearer {user_c_token}"}
    user_d_headers = {"Authorization": f"Bearer {user_d_token}"}
    user_e_headers = {"Authorization": f"Bearer {user_e_token}"}

    # Create plan-targeted announcement for 'pro'
    res_pro = await client.post(
        "/api/v1/announcements",
        headers=admin_headers,
        json={
            "title": "Pro Exclusives",
            "body": "Welcome Pro tier users to advanced features.",
            "priority": "important",
            "audience_type": "plan",
            "audience_reference": "pro",
            "is_published": True
        }
    )
    assert res_pro.status_code == 201
    pro_ann_id = res_pro.json()["id"]

    # Create a future-scheduled announcement (published_at in 2 hours)
    future_time = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    res_future = await client.post(
        "/api/v1/announcements",
        headers=admin_headers,
        json={
            "title": "Future Scheduled Notice",
            "body": "This notice should NOT be visible yet.",
            "priority": "informational",
            "audience_type": "all",
            "published_at": future_time,
            "is_published": True
        }
    )
    assert res_future.status_code == 201
    future_ann_id = res_future.json()["id"]

    # Verify User C (inherited Pro): sees the Pro announcement, does NOT see future announcement
    res_c = await client.get("/api/v1/announcements/active", headers=user_c_headers)
    assert res_c.status_code == 200
    c_ids = [item["id"] for item in res_c.json()["items"]]
    assert pro_ann_id in c_ids
    assert future_ann_id not in c_ids

    # Verify User D (overridden to Free): does NOT see Pro announcement, does NOT see future announcement
    res_d = await client.get("/api/v1/announcements/active", headers=user_d_headers)
    assert res_d.status_code == 200
    d_ids = [item["id"] for item in res_d.json()["items"]]
    assert pro_ann_id not in d_ids
    assert future_ann_id not in d_ids

    # Verify User E (suspended): receives 403 Forbidden
    res_e = await client.get("/api/v1/announcements/active", headers=user_e_headers)
    assert res_e.status_code == 403
