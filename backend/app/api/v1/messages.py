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
from app.models.message import Message
from app.models.audit import AuditEvent
from app.schemas.message import (
    MessageCreateRequest,
    MessageReplyRequest,
    MessageOut,
    MessageListResponse,
)
from app.api.v1.admin import require_admin

router = APIRouter(prefix="/messages", tags=["Messages"])


def _message_to_out(msg: Message, sender: Optional[User] = None, recipient: Optional[User] = None) -> MessageOut:
    return MessageOut(
        id=msg.id,
        sender_user_id=msg.sender_user_id,
        sender_name=sender.full_name if sender else (msg.sender.full_name if msg.sender else None),
        sender_email=sender.email if sender else (msg.sender.email if msg.sender else None),
        recipient_user_id=msg.recipient_user_id,
        recipient_name=recipient.full_name if recipient else (msg.recipient.full_name if msg.recipient else None),
        recipient_email=recipient.email if recipient else (msg.recipient.email if msg.recipient else None),
        subject=msg.subject,
        body=msg.body,
        priority=msg.priority,
        status=msg.status,
        created_at=msg.created_at,
        read_at=msg.read_at,
        archived_at=msg.archived_at,
    )


@router.post("/send", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
async def send_direct_message(
    req: MessageCreateRequest,
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Administrative endpoint to dispatch a direct, persisted message to a target user.
    Enforces that the recipient exists and records an administrative audit entry.
    """
    # 1. Verify recipient user exists
    stmt = select(User).where(User.id == req.recipient_user_id)
    result = await db.execute(stmt)
    recipient = result.scalar_one_or_none()
    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recipient user with ID '{req.recipient_user_id}' does not exist"
        )

    # 2. Create message
    msg_id = str(uuid.uuid4())
    message = Message(
        id=msg_id,
        sender_user_id=admin_user.id,
        recipient_user_id=recipient.id,
        subject=req.subject.strip(),
        body=req.body.strip(),
        priority=req.priority,
        status="sent",
        created_at=utc_now()
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)

    # 3. Record audit event safely
    try:
        audit_org_id = admin_user.org_id
        if not audit_org_id:
            found_org_id = await db.scalar(select(Organization.id).limit(1))
            audit_org_id = found_org_id

        if audit_org_id:
            audit = AuditEvent(
                org_id=audit_org_id,
                user_id=admin_user.id,
                action="SEND_DIRECT_MESSAGE",
                target_type="User",
                target_id=recipient.id,
                details_json=json.dumps({
                    "message_id": msg_id,
                    "subject": req.subject.strip(),
                    "priority": req.priority,
                    "recipient_email": recipient.email
                }),
                timestamp=utc_now()
            )
            db.add(audit)
            await db.commit()
    except Exception:
        await db.rollback()

    return _message_to_out(message, sender=admin_user, recipient=recipient)


@router.get("/inbox", response_model=MessageListResponse)
async def get_my_inbox(
    include_archived: bool = Query(False, description="Whether to include archived messages"),
    search: Optional[str] = Query(None, description="Search query matching subject or body"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve authenticated user's inbox with real pagination and unread counters.
    Strict tenant/user isolation: user can only see messages where recipient_user_id == current_user.id.
    """
    base_filter = [Message.recipient_user_id == current_user.id]
    if not include_archived:
        base_filter.append(Message.status != "archived")
        base_filter.append(Message.archived_at.is_(None))

    if search and search.strip():
        term = f"%{search.strip()}%"
        base_filter.append(or_(Message.subject.ilike(term), Message.body.ilike(term)))

    # Total matching messages
    count_stmt = select(func.count(Message.id)).where(and_(*base_filter))
    total = (await db.execute(count_stmt)).scalar() or 0

    # Unread count (always unarchived and read_at is null)
    unread_stmt = select(func.count(Message.id)).where(
        and_(
            Message.recipient_user_id == current_user.id,
            Message.read_at.is_(None),
            Message.status != "archived",
            Message.archived_at.is_(None)
        )
    )
    unread_count = (await db.execute(unread_stmt)).scalar() or 0

    # Items query with joined sender details
    items_stmt = (
        select(Message, User)
        .outerjoin(User, Message.sender_user_id == User.id)
        .where(and_(*base_filter))
        .order_by(Message.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    items_result = await db.execute(items_stmt)
    rows = items_result.all()

    items = [
        _message_to_out(msg, sender=sndr, recipient=current_user)
        for msg, sndr in rows
    ]

    return MessageListResponse(
        items=items,
        total=total,
        unread_count=unread_count,
        page=page,
        limit=limit
    )


@router.get("/admin/history", response_model=MessageListResponse)
async def get_admin_message_history(
    recipient_id: Optional[str] = Query(None, description="Filter by recipient user ID"),
    search: Optional[str] = Query(None, description="Search term for subject or body"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Administrative overview of dispatched messages with recipient metadata and delivery/read receipts.
    """
    filters = []
    if recipient_id:
        filters.append(Message.recipient_user_id == recipient_id)
    if search and search.strip():
        term = f"%{search.strip()}%"
        filters.append(or_(Message.subject.ilike(term), Message.body.ilike(term)))

    count_stmt = select(func.count(Message.id))
    if filters:
        count_stmt = count_stmt.where(and_(*filters))
    total = (await db.execute(count_stmt)).scalar() or 0

    sender_alias = User
    # Join sender and recipient
    RecipientUser = User
    items_stmt = (
        select(Message)
        .order_by(Message.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    if filters:
        items_stmt = items_stmt.where(and_(*filters))

    res = await db.execute(items_stmt)
    messages = res.scalars().all()

    # Gather user info
    user_ids = set()
    for m in messages:
        user_ids.add(m.sender_user_id)
        user_ids.add(m.recipient_user_id)

    users_map = {}
    if user_ids:
        u_stmt = select(User).where(User.id.in_(list(user_ids)))
        u_res = await db.execute(u_stmt)
        users_map = {u.id: u for u in u_res.scalars().all()}

    items = [
        _message_to_out(
            m,
            sender=users_map.get(m.sender_user_id),
            recipient=users_map.get(m.recipient_user_id)
        )
        for m in messages
    ]

    return MessageListResponse(
        items=items,
        total=total,
        unread_count=0,
        page=page,
        limit=limit
    )


@router.get("/{message_id}", response_model=MessageOut)
async def get_message(
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Fetch a single message by ID. Enforces strict authorization: only recipient, sender,
    or administrative roles can view the message.
    """
    stmt = select(Message).where(Message.id == message_id)
    res = await db.execute(stmt)
    message = res.scalar_one_or_none()
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )

    # Permission check: recipient, sender, or admin
    is_recipient = message.recipient_user_id == current_user.id
    is_sender = message.sender_user_id == current_user.id
    is_admin = current_user.role in ("admin", "superadmin")

    if not (is_recipient or is_sender or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this message"
        )

    # Fetch sender and recipient
    u_stmt = select(User).where(User.id.in_([message.sender_user_id, message.recipient_user_id]))
    u_res = await db.execute(u_stmt)
    users_map = {u.id: u for u in u_res.scalars().all()}

    return _message_to_out(
        message,
        sender=users_map.get(message.sender_user_id),
        recipient=users_map.get(message.recipient_user_id)
    )


@router.patch("/{message_id}/read", response_model=MessageOut)
async def mark_message_as_read(
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Mark a message as read. Only the recipient may update the read state of their message.
    """
    stmt = select(Message).where(Message.id == message_id)
    res = await db.execute(stmt)
    message = res.scalar_one_or_none()
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    if message.recipient_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the message recipient can update its read state"
        )

    if not message.read_at:
        message.read_at = utc_now()
        message.status = "delivered"
        await db.commit()
        await db.refresh(message)

    # Load sender for output
    s_stmt = select(User).where(User.id == message.sender_user_id)
    s_res = await db.execute(s_stmt)
    sender = s_res.scalar_one_or_none()

    return _message_to_out(message, sender=sender, recipient=current_user)


@router.patch("/{message_id}/archive", response_model=MessageOut)
async def archive_message(
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Archive a message from the recipient's primary inbox view.
    """
    stmt = select(Message).where(Message.id == message_id)
    res = await db.execute(stmt)
    message = res.scalar_one_or_none()
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    if message.recipient_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the message recipient can archive this message"
        )

    message.status = "archived"
    message.archived_at = utc_now()
    await db.commit()
    await db.refresh(message)

    s_stmt = select(User).where(User.id == message.sender_user_id)
    s_res = await db.execute(s_stmt)
    sender = s_res.scalar_one_or_none()

    return _message_to_out(message, sender=sender, recipient=current_user)


@router.post("/{message_id}/reply", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
async def reply_to_message(
    message_id: str,
    req: MessageReplyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Allows a recipient user to respond directly back to an administrative message.
    """
    stmt = select(Message).where(Message.id == message_id)
    res = await db.execute(stmt)
    parent_msg = res.scalar_one_or_none()
    if not parent_msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Original message not found")

    if parent_msg.recipient_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only reply to messages where you are the recipient"
        )

    # The recipient of the reply is the original sender
    reply_subject = f"Re: {parent_msg.subject}" if not parent_msg.subject.startswith("Re:") else parent_msg.subject
    reply_msg = Message(
        sender_user_id=current_user.id,
        recipient_user_id=parent_msg.sender_user_id,
        subject=reply_subject,
        body=req.body.strip(),
        priority=parent_msg.priority,
        status="sent",
        created_at=utc_now()
    )
    db.add(reply_msg)
    await db.commit()
    await db.refresh(reply_msg)

    # Fetch original sender
    orig_sender_stmt = select(User).where(User.id == parent_msg.sender_user_id)
    orig_sender = (await db.execute(orig_sender_stmt)).scalar_one_or_none()

    return _message_to_out(reply_msg, sender=current_user, recipient=orig_sender)
