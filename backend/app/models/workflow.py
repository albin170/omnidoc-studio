import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, Text, DateTime, ForeignKey, Integer
from app.core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    name = Column(String(128), nullable=False)
    description = Column(String(255), nullable=True)
    nodes_json = Column(Text, nullable=False)
    edges_json = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

class WorkflowCheckpointModel(Base):
    __tablename__ = "workflow_checkpoints"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    job_id = Column(String(36), nullable=False, index=True)
    plan_id = Column(String(64), nullable=False, index=True)
    step_id = Column(String(64), nullable=False, index=True)
    status = Column(String(32), nullable=False)
    attempt = Column(Integer, default=1, nullable=False)
    result_json = Column(Text, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

class IdempotencyRecordModel(Base):
    __tablename__ = "idempotency_records"

    key = Column(String(128), primary_key=True)
    result_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
