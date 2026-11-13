import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base, utc_now

class Message(Base):
    __tablename__ = "messages"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sender_user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    recipient_user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    subject = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    priority = Column(String(32), default="normal", nullable=False)  # normal, important, urgent
    status = Column(String(32), default="sent", nullable=False)  # sent, delivered, archived
    
    created_at = Column(DateTime, default=utc_now, nullable=False, index=True)
    read_at = Column(DateTime, nullable=True)
    archived_at = Column(DateTime, nullable=True)

    sender = relationship("User", foreign_keys=[sender_user_id], backref="sent_messages")
    recipient = relationship("User", foreign_keys=[recipient_user_id], backref="received_messages")

    __table_args__ = (
        Index("ix_messages_recipient_created", "recipient_user_id", "created_at"),
        Index("ix_messages_recipient_status", "recipient_user_id", "status"),
    )
