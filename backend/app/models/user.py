import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(128), default="OmniDoc User", nullable=False)
    role = Column(String(32), default="user", nullable=False) # admin, staff, user, auditor
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Consent Flags
    terms_accepted = Column(Boolean, default=False, nullable=False)
    privacy_accepted = Column(Boolean, default=False, nullable=False)
    ai_consent = Column(Boolean, default=False, nullable=False)
    marketing_consent = Column(Boolean, default=False, nullable=False)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    org_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    organization = relationship("Organization", back_populates="users")
    documents = relationship("Document", back_populates="owner")
    jobs = relationship("Job", back_populates="creator")
    consent_records = relationship("ConsentRecord", back_populates="user", cascade="all, delete-orphan", order_by="desc(ConsentRecord.timestamp)")
