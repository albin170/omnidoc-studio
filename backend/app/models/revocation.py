import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Index
from app.core.database import Base, utc_now

class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    token_jti = Column(String(64), nullable=False, unique=True, index=True)
    user_id = Column(String(36), nullable=False, index=True)
    revoked_at = Column(DateTime, default=utc_now, nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)

