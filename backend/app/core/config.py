import os
from typing import List, Set
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "OmniDoc Studio 2.0 — Autonomous Document Engineering Platform"
    API_V1_STR: str = "/api/v1"
    
    # Security & Tokens
    SECRET_KEY: str = os.getenv("SECRET_KEY", "omnidoc_prod_sec_key_d92f8a1103c8479e2bc91e7041a384f5")
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
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://omnidoc-studio-jet.vercel.app",
        "*"
    ]

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()

