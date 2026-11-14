import uuid
import json
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_, update

from app.core.database import get_db, utc_now
from app.core.security import get_current_user
from app.models.user import User
from app.models.organization import Organization
from app.models.announcement import Announcement, AnnouncementRead
from app.models.audit import AuditEvent
from app.schemas.announcement import (
    AnnouncementCreateRequest,
    AnnouncementUpdateRequest,
    AnnouncementOut,
    AnnouncementListResponse,
)
from app.api.v1.admin import require_admin
from app.services.entitlement_service import get_effective_plan_tier

router = APIRouter(prefix="/announcements", tags=["Announcements"])


def _normalize_dt(dt: Optional[datetime]) -> Optional[datetime]:
    if not dt:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _announcement_to_out(
    ann: Announcement,
    creator: Optional[User] = None,
    is_read: bool = False,
    is_dismissed: bool = False,
    read_count: int = 0
) -> AnnouncementOut:
    return AnnouncementOut(
        id=ann.id,
        title=ann.title,
        body=ann.body,
        priority=ann.priority,
        audience_type=ann.audience_type,
        audience_reference=ann.audience_reference,
        created_by=ann.created_by,
        creator_name=creator.full_name if creator else (ann.creator.full_name if ann.creator else None),
        created_at=ann.created_at,
        published_at=ann.published_at,
        expires_at=ann.expires_at,
        is_published=ann.is_published,
        is_archived=ann.is_archived,
        is_read=is_read,
        is_dismissed=is_dismissed,
        read_count=read_count
    )


@router.post("", response_model=AnnouncementOut, status_code=status.HTTP_201_CREATED)
async def create_announcement(
    req: AnnouncementCreateRequest,
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Publish or draft a new global or targeted announcement.
    Only accessible by administrators and superadministrators.
    """
    now = utc_now()
    ann_id = str(uuid.uuid4())

    published_dt = _normalize_dt(req.published_at) or (now if req.is_published else None)
    expires_dt = _normalize_dt(req.expires_at)

    announcement = Announcement(
        id=ann_id,
        title=req.title.strip(),
        body=req.body.strip(),
        priority=req.priority,
        audience_type=req.audience_type,
        audience_reference=req.audience_reference.strip() if req.audience_reference else None,
        created_by=admin_user.id,
        created_at=now,
        published_at=published_dt,
        expires_at=expires_dt,
        is_published=req.is_published,
        is_archived=False
    )
    db.add(announcement)
    await db.commit()
    await db.refresh(announcement)

    # Safe asynchronous audit logging without blocking or failing publication
    try:
        audit_org_id = admin_user.org_id
        if not audit_org_id:
            found_org_id = await db.scalar(select(Organization.id).limit(1))
            if not found_org_id:
                default_org = Organization(name="OmniDoc Master Org", slug="omnidoc-master", plan_tier="enterprise")
                db.add(default_org)
                await db.flush()
                found_org_id = default_org.id
            audit_org_id = found_org_id

        if audit_org_id:
            audit = AuditEvent(
                org_id=audit_org_id,
                user_id=admin_user.id,
                action="CREATE_ANNOUNCEMENT",
                target_type="Announcement",
                target_id=ann_id,
                details_json=json.dumps({
                    "title": announcement.title,
                    "priority": announcement.priority,
                    "audience_type": announcement.audience_type,
                    "audience_reference": announcement.audience_reference,
                    "is_published": announcement.is_published
                }),
                timestamp=now
            )
            db.add(audit)
            await db.commit()
    except Exception:
        await db.rollback()

    return _announcement_to_out(announcement, creator=admin_user)


@router.put("/{announcement_id}", response_model=AnnouncementOut)
async def update_announcement(
    announcement_id: str,
    req: AnnouncementUpdateRequest,
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Modify an existing announcement's contents, audience, priority, or lifecycle.
    """
    stmt = select(Announcement).where(Announcement.id == announcement_id)
    res = await db.execute(stmt)
    ann = res.scalar_one_or_none()
    if not ann:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")

    if req.title is not None:
        ann.title = req.title.strip()
    if req.body is not None:
        ann.body = req.body.strip()
    if req.priority is not None:
        ann.priority = req.priority
    if req.audience_type is not None:
        ann.audience_type = req.audience_type
    if req.audience_reference is not None:
        ann.audience_reference = req.audience_reference.strip() if req.audience_reference else None
    if req.published_at is not None:
        ann.published_at = _normalize_dt(req.published_at)
    if req.expires_at is not None:
        ann.expires_at = _normalize_dt(req.expires_at)
    if req.is_published is not None:
        if req.is_published and not ann.published_at:
            ann.published_at = utc_now()
        ann.is_published = req.is_published
    if req.is_archived is not None:
        ann.is_archived = req.is_archived

    await db.commit()
    await db.refresh(ann)

    try:
        audit_org_id = admin_user.org_id
        if not audit_org_id:
            found_org_id = await db.scalar(select(Organization.id).limit(1))
            audit_org_id = found_org_id

        if audit_org_id:
            audit = AuditEvent(
                org_id=audit_org_id,
                user_id=admin_user.id,
                action="UPDATE_ANNOUNCEMENT",
                target_type="Announcement",
                target_id=ann.id,
                details_json=json.dumps({"updated_fields": [k for k, v in req.model_dump().items() if v is not None]}),
                timestamp=utc_now()
            )
            db.add(audit)
            await db.commit()
    except Exception:
        await db.rollback()

    return _announcement_to_out(ann, creator=admin_user)


@router.delete("/{announcement_id}")
async def delete_or_archive_announcement(
    announcement_id: str,
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Archive and unpublish an announcement. Preserves audit integrity.
    """
    stmt = select(Announcement).where(Announcement.id == announcement_id)
    res = await db.execute(stmt)
    ann = res.scalar_one_or_none()
    if not ann:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")

    ann.is_published = False
    ann.is_archived = True
    await db.commit()

    try:
        audit_org_id = admin_user.org_id
        if not audit_org_id:
            found_org_id = await db.scalar(select(Organization.id).limit(1))
            audit_org_id = found_org_id

        if audit_org_id:
            audit = AuditEvent(
                org_id=audit_org_id,
                user_id=admin_user.id,
                action="ARCHIVE_ANNOUNCEMENT",
                target_type="Announcement",
                target_id=ann.id,
                details_json=json.dumps({"title": ann.title}),
                timestamp=utc_now()
            )
            db.add(audit)
            await db.commit()
    except Exception:
        await db.rollback()

    return {"status": "archived", "id": announcement_id}


@router.get("/admin", response_model=AnnouncementListResponse)
async def list_admin_announcements(
    include_archived: bool = Query(True),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Administrative list of all announcements, including readership counts.
    """
    filters = []
    if not include_archived:
        filters.append(Announcement.is_archived.is_(False))

    count_stmt = select(func.count(Announcement.id))
    if filters:
        count_stmt = count_stmt.where(and_(*filters))
    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = (
        select(Announcement, User)
        .outerjoin(User, Announcement.created_by == User.id)
        .order_by(Announcement.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    if filters:
        stmt = stmt.where(and_(*filters))

    res = await db.execute(stmt)
    rows = res.all()

    # Get read counts
    ann_ids = [ann.id for ann, _ in rows]
    read_counts = {}
    if ann_ids:
        r_stmt = (
            select(AnnouncementRead.announcement_id, func.count(AnnouncementRead.id))
            .where(AnnouncementRead.announcement_id.in_(ann_ids))
            .group_by(AnnouncementRead.announcement_id)
        )
        r_res = await db.execute(r_stmt)
        read_counts = {ann_id: cnt for ann_id, cnt in r_res.all()}

    items = [
        _announcement_to_out(ann, creator=creator, read_count=read_counts.get(ann.id, 0))
        for ann, creator in rows
    ]

    return AnnouncementListResponse(items=items, total=total)


@router.get("/active", response_model=AnnouncementListResponse)
async def get_active_announcements_for_user(
    include_dismissed: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Fetch active, scheduled, and non-expired announcements that apply to the current user based on:
    - Audience: 'all'
    - Audience: 'role' matching user's role
    - Audience: 'plan' matching user's effective plan tier (individual override or organization inheritance)
    - Audience: 'user' matching user's ID
    Includes user-specific read and dismissal state.
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Suspended or inactive user account"
        )

    now = utc_now()
    effective_plan = await get_effective_plan_tier(current_user, db)

    # Audience filter
    audience_conds = [Announcement.audience_type == "all"]
    if current_user.role:
        audience_conds.append(
            and_(
                Announcement.audience_type == "role",
                func.lower(Announcement.audience_reference) == current_user.role.lower()
            )
        )
    if effective_plan:
        audience_conds.append(
            and_(
                Announcement.audience_type == "plan",
                func.lower(Announcement.audience_reference) == effective_plan.lower()
            )
        )
    audience_conds.append(
        and_(Announcement.audience_type == "user", Announcement.audience_reference == current_user.id)
    )

    base_filter = [
        Announcement.is_published.is_(True),
        Announcement.is_archived.is_(False),
        # Must not be scheduled in the future
        or_(Announcement.published_at.is_(None), Announcement.published_at <= now),
        # Must not be expired
        or_(Announcement.expires_at.is_(None), Announcement.expires_at > now),
        or_(*audience_conds)
    ]

    # Join with AnnouncementRead for current_user
    stmt = (
        select(Announcement, AnnouncementRead, User)
        .outerjoin(
            AnnouncementRead,
            and_(
                AnnouncementRead.announcement_id == Announcement.id,
                AnnouncementRead.user_id == current_user.id
            )
        )
        .outerjoin(User, Announcement.created_by == User.id)
        .where(and_(*base_filter))
        .order_by(
            # Sort critical first, then important, then informational; then latest
            Announcement.created_at.desc()
        )
    )

    res = await db.execute(stmt)
    rows = res.all()

    items = []
    for ann, read_rec, creator in rows:
        is_read = bool(read_rec and read_rec.read_at)
        is_dismissed = bool(read_rec and read_rec.dismissed_at)

        # Critical announcements can never be dismissed
        if not include_dismissed and is_dismissed and ann.priority != "critical":
            continue

        items.append(_announcement_to_out(
            ann,
            creator=creator,
            is_read=is_read,
            is_dismissed=is_dismissed
        ))

    # Sort priority order: critical > important > informational
    priority_order = {"critical": 0, "important": 1, "informational": 2}
    items.sort(key=lambda x: (priority_order.get(x.priority, 3), -x.created_at.timestamp()))

    return AnnouncementListResponse(items=items, total=len(items))


@router.post("/{announcement_id}/read")
async def mark_announcement_as_read(
    announcement_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Mark an announcement as read by the current user.
    """
    # Check announcement exists
    ann_stmt = select(Announcement).where(Announcement.id == announcement_id)
    ann = (await db.execute(ann_stmt)).scalar_one_or_none()
    if not ann:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")

    stmt = select(AnnouncementRead).where(
        AnnouncementRead.announcement_id == announcement_id,
        AnnouncementRead.user_id == current_user.id
    )
    read_rec = (await db.execute(stmt)).scalar_one_or_none()

    now = utc_now()
    if not read_rec:
        read_rec = AnnouncementRead(
            announcement_id=announcement_id,
            user_id=current_user.id,
            read_at=now
        )
        db.add(read_rec)
    else:
        if not read_rec.read_at:
            read_rec.read_at = now

    await db.commit()
    return {"status": "read", "announcement_id": announcement_id, "read_at": now.isoformat()}


@router.post("/{announcement_id}/dismiss")
async def dismiss_announcement(
    announcement_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Dismiss an announcement for the current user. Critical announcements cannot be dismissed.
    """
    ann_stmt = select(Announcement).where(Announcement.id == announcement_id)
    ann = (await db.execute(ann_stmt)).scalar_one_or_none()
    if not ann:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")

    if ann.priority == "critical":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Critical announcements cannot be dismissed"
        )

    stmt = select(AnnouncementRead).where(
        AnnouncementRead.announcement_id == announcement_id,
        AnnouncementRead.user_id == current_user.id
    )
    read_rec = (await db.execute(stmt)).scalar_one_or_none()

    now = utc_now()
    if not read_rec:
        read_rec = AnnouncementRead(
            announcement_id=announcement_id,
            user_id=current_user.id,
            read_at=now,
            dismissed_at=now
        )
        db.add(read_rec)
    else:
        read_rec.dismissed_at = now
        if not read_rec.read_at:
            read_rec.read_at = now

    await db.commit()
    return {"status": "dismissed", "announcement_id": announcement_id}
