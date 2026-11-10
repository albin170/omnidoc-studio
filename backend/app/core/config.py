import os
import sys
import logging
from typing import List, Set, Optional
from pydantic_settings import BaseSettings

# Structured logging configuration
import logging.config
from pythonjsonlogger import jsonlogger

LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": jsonlogger.JsonFormatter,
            "fmt": "%(asctime)s %(levelname)s %(name)s %(message)s",
        }
    },
    "handlers": {
        "default": {
            "class": "logging.StreamHandler",
            "formatter": "json",
            "stream": "ext://sys.stdout",
        }
    },
    "root": {
        "level": os.getenv("LOG_LEVEL", "INFO"),
        "handlers": ["default"],
    },
}

logging.config.dictConfig(LOGGING_CONFIG)
logger = logging.getLogger("omnidoc")

DEFAULT_DEV_SECRET = "omnidoc_dev_sec_key_d92f8a1103c8479e2bc91e7041a384f5"

class Settings(BaseSettings):
    # Existing fields ... (kept unchanged)
    # Supabase configuration (optional)
    SUPABASE_URL: Optional[str] = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    SUPABASE_BUCKET_NAME: Optional[str] = os.getenv("SUPABASE_BUCKET_NAME")

    # Database connection pool settings (optional)
    DATABASE_POOL_SIZE: int = int(os.getenv("DATABASE_POOL_SIZE", "10"))
    DATABASE_MAX_OVERFLOW: int = int(os.getenv("DATABASE_MAX_OVERFLOW", "20"))
    PROJECT_NAME: str = "OmniDoc Studio 2.0 — Autonomous Document Engineering Platform"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # Security & Tokens
    SECRET_KEY: str = os.getenv("SECRET_KEY", DEFAULT_DEV_SECRET)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 24 hours
    
    # Database
    is_vercel: bool = bool(os.getenv("VERCEL"))
    # Default SQLite in-memory database for development and testing if not provided.
    default_db: str = "sqlite+aiosqlite:///./test.db"

    DATABASE_URL: str = os.getenv("DATABASE_URL", default_db)
    
    # Storage Vault
    default_storage: str = "/tmp/storage_vault" if is_vercel else "./storage_vault"
    STORAGE_DIR: str = os.getenv("STORAGE_DIR", default_storage)
    MAX_UPLOAD_SIZE_BYTES: int = int(os.getenv("MAX_UPLOAD_SIZE_BYTES", str(500 * 1024 * 1024))) # 500 MB (plan limits up to 500MB)
    MAX_ARCHIVE_EXPANSION_BYTES: int = int(os.getenv("MAX_ARCHIVE_EXPANSION_BYTES", str(500 * 1024 * 1024))) # 500 MB (Decompression bomb guard)
    
    # Allowed Extensions
    ALLOWED_EXTENSIONS: Set[str] = {
        "pdf", "docx", "xlsx", "pptx", "png", "jpg", "jpeg", "webp", "csv", "txt", "md", "html"
    }
    
    # Email & Notifications
    SMTP_HOST: Optional[str] = os.getenv("SMTP_HOST")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: Optional[str] = os.getenv("SMTP_USER")
    SMTP_PASSWORD: Optional[str] = os.getenv("SMTP_PASSWORD")
    EMAILS_FROM_EMAIL: str = os.getenv("EMAILS_FROM_EMAIL", "noreply@omnidoc.studio")
    EMAILS_FROM_NAME: str = os.getenv("EMAILS_FROM_NAME", "OmniDoc Studio Security")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

    # Payment Gateway (Stripe)
    STRIPE_SECRET_KEY: Optional[str] = os.getenv("STRIPE_SECRET_KEY")
    STRIPE_WEBHOOK_SECRET: Optional[str] = os.getenv("STRIPE_WEBHOOK_SECRET")

    # Persistent Storage (Supabase / S3 / R2)
    STORAGE_PROVIDER: str = os.getenv("STORAGE_PROVIDER", "local") # "supabase", "s3", or "local"
    SUPABASE_URL: Optional[str] = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    SUPABASE_BUCKET_NAME: str = os.getenv("SUPABASE_BUCKET_NAME", "documents")
    S3_BUCKET_NAME: Optional[str] = os.getenv("S3_BUCKET_NAME")
    S3_ENDPOINT_URL: Optional[str] = os.getenv("S3_ENDPOINT_URL")
    AWS_ACCESS_KEY_ID: Optional[str] = os.getenv("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY: Optional[str] = os.getenv("AWS_SECRET_ACCESS_KEY")
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")

    # Explicit CORS Origins (Disallow wildcard '*' when allow_credentials=True)
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://omnidoc-studio-jet.vercel.app"
    ]

    # Trusted proxy network configuration for rate limiting
    TRUSTED_PROXIES: List[str] = [p.strip() for p in os.getenv("TRUSTED_PROXIES", "127.0.0.1,::1").split(",") if p.strip()]
    TRUST_PROXY_HEADERS: bool = os.getenv("TRUST_PROXY_HEADERS", "false").lower() in ("true", "1")

    def validate_production_security(self):
        """Validate production-specific security constraints.
        Ensures that in production mode a non-default secret key is set,
        sufficient entropy and length are enforced, and wildcard CORS origins are prohibited.
        """
        # Fail closed: detect production environments even if ENVIRONMENT variable was omitted
        is_cloud_prod = bool(
            os.getenv("VERCEL") or os.getenv("RENDER") or os.getenv("FLY_APP_NAME") or
            os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("K_SERVICE")
        )
        if is_cloud_prod and self.ENVIRONMENT.lower() == "development":
            raise ValueError(
                "CRITICAL SECURITY CONFIGURATION ERROR: Cloud deployment detected without explicit production ENVIRONMENT configuration. Failing closed."
            )

        if self.ENVIRONMENT.lower() in ("production", "prod"):
            if not self.SECRET_KEY or self.SECRET_KEY == DEFAULT_DEV_SECRET:
                raise ValueError(
                    "CRITICAL SECURITY CONFIGURATION ERROR: Production mode requires a secure, non-default SECRET_KEY environment variable with at least 32 bytes of entropy."
                )
            if len(self.SECRET_KEY) < 32:
                raise ValueError(
                    "CRITICAL SECURITY CONFIGURATION ERROR: Production mode requires a secure SECRET_KEY with at least 32 characters."
                )
            if "*" in self.CORS_ORIGINS:
                raise ValueError(
                    "CRITICAL SECURITY CONFIGURATION ERROR: Wildcard origin '*' is forbidden when credentials are enabled in production CORS."
                )
            # Enforce non-trivial entropy for production secret
            if len(set(self.SECRET_KEY)) < 6:
                raise ValueError(
                    "CRITICAL SECURITY CONFIGURATION ERROR: Production SECRET_KEY lacks sufficient cryptographic entropy."
                )
            if not self.DATABASE_URL or "sqlite" in self.DATABASE_URL.lower():
                raise ValueError(
                    "CRITICAL CONFIGURATION ERROR: Production requires a persistent PostgreSQL database connection (e.g., postgresql+asyncpg://...). Temporary SQLite is strictly prohibited in production."
                )
            if self.STORAGE_PROVIDER.lower() in ("local", "") or self.STORAGE_PROVIDER.lower() not in ("s3", "r2", "supabase"):
                raise ValueError(
                    "CRITICAL CONFIGURATION ERROR: Production requires persistent object storage (STORAGE_PROVIDER=s3 or compatible). Local ephemeral storage is strictly prohibited in production."
                )
            if self.STORAGE_PROVIDER.lower() == "supabase":
                if not self.SUPABASE_URL or not self.SUPABASE_SERVICE_ROLE_KEY:
                    raise ValueError(
                        "CRITICAL CONFIGURATION ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured when STORAGE_PROVIDER=supabase in production."
                    )
            elif self.STORAGE_PROVIDER.lower() == "s3":
                if not self.S3_BUCKET_NAME:
                    raise ValueError(
                        "CRITICAL CONFIGURATION ERROR: S3_BUCKET_NAME must be configured when STORAGE_PROVIDER=s3 in production."
                    )
                if not self.AWS_ACCESS_KEY_ID or not self.AWS_SECRET_ACCESS_KEY:
                    raise ValueError(
                        "CRITICAL CONFIGURATION ERROR: AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be configured when STORAGE_PROVIDER=s3 in production."
                    )


    class Config:
        env_file = ".env"
        extra = "allow"







    def validate_db_url(self):
        if not self.DATABASE_URL:
            raise ValueError(
                "CRITICAL CONFIGURATION ERROR: DATABASE_URL must be set for any environment."
            )
        # Ensure production security constraints are also validated
        self.validate_production_security()



settings = Settings()
settings.validate_db_url()

