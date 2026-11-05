import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class VerificationReceipt(Base):
    __tablename__ = "verification_receipts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)

    signature_algorithm = Column(String(32), default="HMAC-SHA256", nullable=False)
    signature = Column(String(128), nullable=False)
    signable_payload = Column(Text, nullable=False)
    verification_status = Column(String(32), default="VERIFIED", nullable=False)
    
    # Serialized verification checks (page dimensions, table cells, text hash comparison, visual diff)
    checks_json = Column(Text, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    document = relationship("Document", back_populates="verifications")

