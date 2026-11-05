import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class ConsentRecord(Base):
    __tablename__ = "consent_records"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    consent_type = Column(String(64), nullable=False, index=True) # terms_and_conditions, privacy_policy, ai_processing, marketing_communication
    policy_version = Column(String(32), nullable=False) # e.g. 2026.1
    granted = Column(Boolean, nullable=False, default=True) # True = accepted, False = withdrawn
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(256), nullable=True)

    user = relationship("User", back_populates="consent_records")

