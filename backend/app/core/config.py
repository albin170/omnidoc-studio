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
    MAX_UPLOAD_SIZE_BYTES: int = 50 * 1024 * 1024 # 50 MB
    MAX_ARCHIVE_EXPANSION_BYTES: int = 75 * 1024 * 1024 # 75 MB (Decompression bomb guard)
    
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

    # Persistent Storage (S3 / R2)
    STORAGE_PROVIDER: str = os.getenv("STORAGE_PROVIDER", "local") # "local" or "s3"
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


    def validate_production_security(self):
        """Validate production-specific security constraints.
        Ensures that in production mode a non-default secret key is set and
        wildcard CORS origins are prohibited.
        """
        if self.ENVIRONMENT.lower() in ("production", "prod"):
            if not self.SECRET_KEY or self.SECRET_KEY == DEFAULT_DEV_SECRET:
                raise ValueError(
                    "CRITICAL SECURITY CONFIGURATION ERROR: Production mode requires a secure, non-default SECRET_KEY environment variable with at least 32 bytes of entropy."
                )
            if "*" in self.CORS_ORIGINS:
                raise ValueError(
                    "CRITICAL SECURITY CONFIGURATION ERROR: Wildcard origin '*' is forbidden when credentials are enabled in production CORS."
                )
            if self.STORAGE_PROVIDER == "s3" and not self.S3_BUCKET_NAME:
                raise ValueError(
                    "CRITICAL CONFIGURATION ERROR: S3_BUCKET_NAME must be configured when STORAGE_PROVIDER=s3 in production."
                )


    class Config:
        env_file = ".env"
        extra = "allow"







    def validate_db_url(self):
        if not self.DATABASE_URL:
            raise ValueError(
                "CRITICAL CONFIGURATION ERROR: DATABASE_URL must be set for any environment."
            )
        if self.ENVIRONMENT.lower() in ("production", "prod"):
            if "sqlite" in self.DATABASE_URL.lower():
                raise ValueError(
                    "CRITICAL CONFIGURATION ERROR: Production requires a persistent PostgreSQL database connection (e.g., postgresql+asyncpg://...). Temporary SQLite is strictly prohibited in production."
                )
        # Ensure production security constraints are also validated
        self.validate_production_security()



settings = Settings()
settings.validate_db_url()

