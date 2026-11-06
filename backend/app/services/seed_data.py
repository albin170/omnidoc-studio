import json
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.subscription_management import PlanModel, FeatureModel, UiConfigurationModel
from app.models.user import User
from app.models.organization import Organization
from app.core.security import get_password_hash

DEFAULT_FEATURES = [
    {"feature_key": "pdf_tools", "name": "PDF Studio", "category": "PDF Tools", "description": "View, annotate, rotate, split, merge, and export PDF pages."},
    {"feature_key": "pdf_sanitizer", "name": "PDF Redaction & Sanitization", "category": "Security", "description": "Destructive byte stream scrubbing, metadata deletion, and opaque blackouts."},
    {"feature_key": "docx_studio", "name": "Word Document Editor", "category": "Office Suites", "description": "OpenXML text, styles, tables, and document editing."},
    {"feature_key": "sheet_studio", "name": "Excel Spreadsheets", "category": "Office Suites", "description": "Multi-sheet calculation, formulas, formatting, and data tables."},
    {"feature_key": "slide_studio", "name": "Presentation Studio", "category": "Office Suites", "description": "Slide deck creator and presentation generator."},
    {"feature_key": "image_studio", "name": "Graphics Studio", "category": "Creative & Media", "description": "Crop, resize, filters, format transcoding, and visual adjustments."},
    {"feature_key": "ocr_engine", "name": "Optical Character Recognition", "category": "OCR & Vision", "description": "Multi-language document text extraction and OCR scanning."},
    {"feature_key": "conversion_hub", "name": "Universal Conversion Hub", "category": "Conversion", "description": "Cross-format conversion between PDF, DOCX, XLSX, PPTX, and images."},
    {"feature_key": "workflows", "name": "Visual Workflow Automation", "category": "Automation", "description": "Automated document engineering pipelines with conditional nodes."},
    {"feature_key": "autonomous_agent", "name": "Autonomous Document Intelligence", "category": "AI Intelligence", "description": "DAG-based document plan generation, key-value extraction, and auditing."},
    {"feature_key": "document_forensics", "name": "Document DNA & Forensics", "category": "Security", "description": "Cryptographic hashing, revision comparison, and structural diffs."},
    {"feature_key": "api_access", "name": "Developer API & Integrations", "category": "Developer Tools", "description": "Programmatic REST API keys, webhooks, and headless automation."}
]

DEFAULT_PLANS = [
    {
        "name": "Free Community",
        "slug": "free",
        "description": "Essential document viewing and basic conversions for individuals.",
        "monthly_price_cents": 0,
        "annual_price_cents": 0,
        "billing_interval": "month",
        "is_active": True,
        "is_default": True,
        "display_order": 1,
        "upload_limit": 20,
        "max_file_size_bytes": 25 * 1024 * 1024,
        "storage_quota_bytes": 100 * 1024 * 1024,
        "monthly_processing_quota": 50,
        "ocr_quota": 15,
        "ai_processing_quota": 10,
        "workflow_quota": 3,
        "has_api_access": False,
        "support_level": "community",
        "features": ["pdf_tools", "docx_studio", "sheet_studio", "image_studio", "conversion_hub"]
    },
    {
        "name": "Starter Pro",
        "slug": "starter",
        "description": "Extended document workflows, OCR scanning, and visual presentations.",
        "monthly_price_cents": 1900, # $19.00
        "annual_price_cents": 19000, # $190.00
        "billing_interval": "month",
        "is_active": True,
        "is_default": False,
        "display_order": 2,
        "upload_limit": 100,
        "max_file_size_bytes": 50 * 1024 * 1024,
        "storage_quota_bytes": 1024 * 1024 * 1024, # 1GB
        "monthly_processing_quota": 250,
        "ocr_quota": 100,
        "ai_processing_quota": 50,
        "workflow_quota": 25,
        "has_api_access": False,
        "support_level": "email",
        "features": ["pdf_tools", "pdf_sanitizer", "docx_studio", "sheet_studio", "slide_studio", "image_studio", "ocr_engine", "conversion_hub", "workflows"]
    },
    {
        "name": "Professional Suite",
        "slug": "pro",
        "description": "Complete Autonomous Document Engineering with AI intelligence and API access.",
        "monthly_price_cents": 4900, # $49.00
        "annual_price_cents": 49000, # $490.00
        "billing_interval": "month",
        "is_active": True,
        "is_default": False,
        "display_order": 3,
        "upload_limit": 500,
        "max_file_size_bytes": 100 * 1024 * 1024,
        "storage_quota_bytes": 10 * 1024 * 1024 * 1024, # 10GB
        "monthly_processing_quota": 1500,
        "ocr_quota": 500,
        "ai_processing_quota": 300,
        "workflow_quota": 100,
        "has_api_access": True,
        "support_level": "priority",
        "features": ["pdf_tools", "pdf_sanitizer", "docx_studio", "sheet_studio", "slide_studio", "image_studio", "ocr_engine", "conversion_hub", "workflows", "autonomous_agent", "document_forensics", "api_access"]
    },
    {
        "name": "Enterprise Cloud",
        "slug": "enterprise",
        "description": "Unlimited capacity, bespoke workflows, maximum security, and dedicated support.",
        "monthly_price_cents": 19900, # $199.00
        "annual_price_cents": 199000, # $1990.00
        "billing_interval": "month",
        "is_active": True,
        "is_default": False,
        "display_order": 4,
        "upload_limit": -1,
        "max_file_size_bytes": 500 * 1024 * 1024,
        "storage_quota_bytes": 100 * 1024 * 1024 * 1024, # 100GB
        "monthly_processing_quota": 10000,
        "ocr_quota": 5000,
        "ai_processing_quota": 2500,
        "workflow_quota": 1000,
        "has_api_access": True,
        "support_level": "dedicated",
        "features": ["pdf_tools", "pdf_sanitizer", "docx_studio", "sheet_studio", "slide_studio", "image_studio", "ocr_engine", "conversion_hub", "workflows", "autonomous_agent", "document_forensics", "api_access"]
    }
]

async def seed_initial_plans_and_features(db: AsyncSession):
    # Seed features
    for f in DEFAULT_FEATURES:
        existing = await db.scalar(select(FeatureModel).where(FeatureModel.feature_key == f["feature_key"]))
        if not existing:
            feat = FeatureModel(
                feature_key=f["feature_key"],
                name=f["name"],
                description=f["description"],
                category=f["category"],
                is_active=True,
                default_enabled=True
            )
            db.add(feat)

    # Seed plans
    for p in DEFAULT_PLANS:
        existing = await db.scalar(select(PlanModel).where(PlanModel.slug == p["slug"]))
        if not existing:
            plan = PlanModel(
                name=p["name"],
                slug=p["slug"],
                description=p["description"],
                monthly_price_cents=p["monthly_price_cents"],
                annual_price_cents=p["annual_price_cents"],
                billing_interval=p["billing_interval"],
                is_active=p["is_active"],
                is_default=p["is_default"],
                display_order=p["display_order"],
                upload_limit=p["upload_limit"],
                max_file_size_bytes=p["max_file_size_bytes"],
                storage_quota_bytes=p["storage_quota_bytes"],
                monthly_processing_quota=p["monthly_processing_quota"],
                ocr_quota=p["ocr_quota"],
                ai_processing_quota=p["ai_processing_quota"],
                workflow_quota=p["workflow_quota"],
                has_api_access=p["has_api_access"],
                support_level=p["support_level"],
                features_json=json.dumps(p["features"])
            )
            db.add(plan)

    # Seed Global UI configuration if absent
    ui_cfg = await db.scalar(select(UiConfigurationModel).where(UiConfigurationModel.scope == "global", UiConfigurationModel.target_id == "all"))
    if not ui_cfg:
        default_ui = UiConfigurationModel(
            scope="global",
            target_id="all",
            announcement_banner="Welcome to OmniDoc Studio 2.0. Autonomous Document Engineering with verified security.",
            maintenance_mode=False,
            disabled_modules_json="[]",
            feature_flags_json=json.dumps({"ai_assistant_enabled": True, "autonomous_workspace_enabled": True})
        )
        db.add(default_ui)

    await db.commit()
