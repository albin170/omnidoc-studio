import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base, utc_now

class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    priority = Column(String(32), default="informational", nullable=False)  # informational, important, critical
    audience_type = Column(String(32), default="all", nullable=False)  # all, plan, role, user
    audience_reference = Column(String(128), nullable=True)  # e.g. "pro", "enterprise", "admin", or user UUID
    created_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    created_at = Column(DateTime, default=utc_now, nullable=False, index=True)
    published_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    
    is_published = Column(Boolean, default=True, nullable=False, index=True)
    is_archived = Column(Boolean, default=False, nullable=False, index=True)

    creator = relationship("User", foreign_keys=[created_by])
    reads = relationship("AnnouncementRead", back_populates="announcement", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_announcements_published_active", "is_published", "is_archived", "expires_at"),
    )


class AnnouncementRead(Base):
    __tablename__ = "announcement_reads"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    announcement_id = Column(String(36), ForeignKey("announcements.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    read_at = Column(DateTime, default=utc_now, nullable=False)
    dismissed_at = Column(DateTime, nullable=True)

    announcement = relationship("Announcement", back_populates="reads")
    user = relationship("User")

    __table_args__ = (
        Index("ix_announcement_reads_user_announcement", "user_id", "announcement_id", unique=True),
    )
