import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), nullable=True, index=True)

    action = Column(String(64), nullable=False, index=True)
    target_type = Column(String(64), nullable=False)
    target_id = Column(String(64), nullable=False)
    ip_address = Column(String(45), nullable=True)
    details_json = Column(Text, nullable=True)

    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    organization = relationship("Organization", back_populates="audit_events")
