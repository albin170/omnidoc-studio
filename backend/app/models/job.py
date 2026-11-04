import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Job(Base):
    __tablename__ = "jobs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    title = Column(String(255), nullable=False)
    objective = Column(Text, nullable=False)
    # Status: pending, planning, awaiting_approval, running, completed, failed, cancelled
    status = Column(String(32), default="pending", nullable=False, index=True)
    mode = Column(String(32), default="hybrid", nullable=False) # local, hybrid, cloud

    plan_json = Column(Text, nullable=True)
    current_step_index = Column(Integer, default=0, nullable=False)
    total_steps = Column(Integer, default=0, nullable=False)
    
    execution_history_json = Column(Text, nullable=True) # Step results, timestamps, and tool audits
    result_json = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    organization = relationship("Organization", back_populates="jobs")
    creator = relationship("User", back_populates="jobs")
