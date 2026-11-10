import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, BigInteger, Boolean, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base, utc_now

class PlanModel(Base):
    __tablename__ = "plans"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(64), nullable=False) # e.g. Free, Starter, Professional, Enterprise
    slug = Column(String(64), unique=True, index=True, nullable=False) # free, starter, pro, enterprise
    description = Column(Text, nullable=True)
    monthly_price_cents = Column(Integer, default=0, nullable=False)
    annual_price_cents = Column(Integer, default=0, nullable=False)
    currency = Column(String(3), default="USD", nullable=False)
    billing_interval = Column(String(16), default="month", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_default = Column(Boolean, default=False, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)

    # Entitlement Limits
    upload_limit = Column(Integer, default=10, nullable=False)
    max_file_size_bytes = Column(BigInteger, default=25 * 1024 * 1024, nullable=False) # 25MB
    storage_quota_bytes = Column(BigInteger, default=100 * 1024 * 1024, nullable=False) # 100MB
    monthly_processing_quota = Column(Integer, default=50, nullable=False)
    ocr_quota = Column(Integer, default=20, nullable=False)
    ai_processing_quota = Column(Integer, default=10, nullable=False)
    workflow_quota = Column(Integer, default=5, nullable=False)
    has_api_access = Column(Boolean, default=False, nullable=False)
    support_level = Column(String(32), default="community", nullable=False) # community, email, priority, dedicated

    # Serialized features enabled for this plan
    features_json = Column(Text, default='["pdf_tools","docx_studio","sheet_studio"]', nullable=False)

    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    subscriptions = relationship("SubscriptionModel", back_populates="plan", cascade="all, delete-orphan")

class FeatureModel(Base):
    __tablename__ = "features"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    feature_key = Column(String(64), unique=True, index=True, nullable=False)
    name = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(64), default="General", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    default_enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

class SubscriptionModel(Base):
    __tablename__ = "subscriptions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    plan_id = Column(String(36), ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False, index=True)
    status = Column(String(32), default="active", nullable=False) # active, trialing, past_due, canceled, expired
    billing_cycle = Column(String(16), default="monthly", nullable=False)
    current_period_start = Column(DateTime, default=utc_now, nullable=False)
    current_period_end = Column(DateTime, nullable=True)
    cancel_at_period_end = Column(Boolean, default=False, nullable=False)
    payment_provider = Column(String(32), default="manual", nullable=False) # manual, stripe, paypal
    external_subscription_id = Column(String(128), nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    plan = relationship("PlanModel", back_populates="subscriptions")

class UserEntitlementOverrideModel(Base):
    __tablename__ = "user_entitlement_overrides"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    feature_key = Column(String(64), index=True, nullable=False)
    is_enabled = Column(Boolean, nullable=True) # null = inherit from plan, True = force enable, False = force disable

    # Custom quota overrides (null = inherit from plan)
    custom_storage_quota_bytes = Column(BigInteger, nullable=True)
    custom_processing_quota = Column(Integer, nullable=True)
    custom_ocr_quota = Column(Integer, nullable=True)
    custom_ai_quota = Column(Integer, nullable=True)
    custom_workflow_quota = Column(Integer, nullable=True)
    custom_max_file_size_bytes = Column(BigInteger, nullable=True)

    expires_at = Column(DateTime, nullable=True)
    admin_notes = Column(Text, nullable=True)
    created_by_admin_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    __table_args__ = (
        Index("ix_user_feature_override", "user_id", "feature_key", unique=True),
    )

class UiConfigurationModel(Base):
    __tablename__ = "ui_configurations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    scope = Column(String(32), default="global", nullable=False) # global, plan, user
    target_id = Column(String(64), default="all", nullable=False) # 'all', plan_id, or user_id
    announcement_banner = Column(Text, nullable=True)
    maintenance_mode = Column(Boolean, default=False, nullable=False)
    maintenance_message = Column(Text, nullable=True)
    disabled_modules_json = Column(Text, default="[]", nullable=False) # JSON array of disabled module keys
    feature_flags_json = Column(Text, default="{}", nullable=False)
    updated_by_admin_id = Column(String(36), nullable=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    __table_args__ = (
        Index("ix_ui_scope_target", "scope", "target_id", unique=True),
    )

class AdminViewSessionModel(Base):
    __tablename__ = "admin_view_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    admin_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    target_user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_token = Column(String(128), unique=True, index=True, nullable=False)
    is_read_only = Column(Boolean, default=True, nullable=False)
    started_at = Column(DateTime, default=utc_now, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    ended_at = Column(DateTime, nullable=True)

