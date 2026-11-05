import os
import sys
import logging
from typing import List, Set
from pydantic_settings import BaseSettings

logger = logging.getLogger("omnidoc.config")

DEFAULT_DEV_SECRET = "omnidoc_dev_sec_key_d92f8a1103c8479e2bc91e7041a384f5"

class Settings(BaseSettings):
    PROJECT_NAME: str = "OmniDoc Studio 2.0 — Autonomous Document Engineering Platform"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # Security & Tokens
    SECRET_KEY: str = os.getenv("SECRET_KEY", DEFAULT_DEV_SECRET)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 24 hours
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./omnidoc_studio.db")
    
    # Storage Vault
    STORAGE_DIR: str = os.getenv("STORAGE_DIR", "./storage_vault")
    MAX_UPLOAD_SIZE_BYTES: int = 50 * 1024 * 1024 # 50 MB
    MAX_ARCHIVE_EXPANSION_BYTES: int = 75 * 1024 * 1024 # 75 MB (Decompression bomb guard)
    
    # Allowed Extensions
    ALLOWED_EXTENSIONS: Set[str] = {
        "pdf", "docx", "xlsx", "pptx", "png", "jpg", "jpeg", "webp", "csv", "txt", "md", "html"
    }
    
    # Explicit CORS Origins (Disallow wildcard '*' when allow_credentials=True)
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://omnidoc-studio-jet.vercel.app"
    ]

    class Config:
        env_file = ".env"
        extra = "allow"

    def validate_production_security(self):
        if self.ENVIRONMENT.lower() in ("production", "prod"):
            if not self.SECRET_KEY or self.SECRET_KEY == DEFAULT_DEV_SECRET:
                raise ValueError(
                    "CRITICAL SECURITY CONFIGURATION ERROR: Production mode requires a secure, non-default SECRET_KEY environment variable with at least 32 bytes of entropy."
                )
            if "*" in self.CORS_ORIGINS:
                raise ValueError(
                    "CRITICAL SECURITY CONFIGURATION ERROR: Wildcard origin '*' is forbidden when credentials are enabled in production CORS."
                )

settings = Settings()
settings.validate_production_security()

