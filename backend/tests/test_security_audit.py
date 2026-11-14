import pytest
import os
from fastapi import HTTPException
from app.core.config import Settings, DEFAULT_DEV_SECRET

def test_production_secret_key_enforcement():
    # Production without non-default secret must raise ValueError on instantiation
    with pytest.raises(ValueError, match="known compromised or default value"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY=DEFAULT_DEV_SECRET,
            CORS_ORIGINS=["http://localhost:5173"]
        )

    # Production with wildcard CORS must raise ValueError on instantiation
    with pytest.raises(ValueError, match=r"Wildcard origin '\*' is forbidden"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="super_secure_random_production_secret_key_12345",
            CORS_ORIGINS=["*"]
        )

    # Production with SQLite must raise ValueError on instantiation
    with pytest.raises(ValueError, match="Production requires a persistent PostgreSQL database"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="super_secure_random_production_secret_key_12345",
            CORS_ORIGINS=["https://omnidoc-studio-jet.vercel.app"],
            DATABASE_URL="sqlite+aiosqlite:///./test.db",
            STORAGE_PROVIDER="s3",
            S3_BUCKET_NAME="production-vault-bucket",
            AWS_ACCESS_KEY_ID="AKIA_PROD_KEY_ID",
            AWS_SECRET_ACCESS_KEY="secret_access_key_entropy_12345"
        )

    # Production with local ephemeral storage must raise ValueError on instantiation
    with pytest.raises(ValueError, match="Production requires persistent object storage"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="super_secure_random_production_secret_key_12345",
            CORS_ORIGINS=["https://omnidoc-studio-jet.vercel.app"],
            DATABASE_URL="postgresql+asyncpg://user:pass@localhost:5432/omnidoc_prod",
            STORAGE_PROVIDER="local"
        )

    # Valid production settings pass
    prod_good_settings = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="super_secure_random_production_secret_key_12345",
        CORS_ORIGINS=["https://omnidoc-studio-jet.vercel.app"],
        DATABASE_URL="postgresql+asyncpg://user:pass@localhost:5432/omnidoc_prod",
        STORAGE_PROVIDER="s3",
        S3_BUCKET_NAME="production-vault-bucket",
        AWS_ACCESS_KEY_ID="AKIA_PROD_KEY_ID",
        AWS_SECRET_ACCESS_KEY="secret_access_key_entropy_12345"
    )
    prod_good_settings.validate_production_security()

