import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    filename = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(128), nullable=False)
    format_type = Column(String(32), nullable=False)
    storage_path = Column(String(512), nullable=False)
    content_hash_sha256 = Column(String(64), nullable=False, index=True)
    version = Column(Integer, default=1, nullable=False)
    parent_document_id = Column(String(36), nullable=True)

    # Serialized JSON of canonical Document Digital Twin
    digital_twin_json = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    organization = relationship("Organization", back_populates="documents")
    owner = relationship("User", back_populates="documents")
    verifications = relationship("VerificationReceipt", back_populates="document", cascade="all, delete-orphan")
