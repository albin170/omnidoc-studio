import pytest
import os
from fastapi import HTTPException
from app.core.config import Settings, DEFAULT_DEV_SECRET

def test_production_secret_key_enforcement():
    # Production without non-default secret must raise ValueError
    prod_bad_settings = Settings(
        ENVIRONMENT="production",
        SECRET_KEY=DEFAULT_DEV_SECRET,
        CORS_ORIGINS=["http://localhost:5173"]
    )
    with pytest.raises(ValueError, match="Production mode requires a secure"):
        prod_bad_settings.validate_production_security()

    # Production with wildcard CORS must raise ValueError
    prod_wildcard_settings = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="a" * 33,
        CORS_ORIGINS=["*"]
    )
    with pytest.raises(ValueError, match=r"Wildcard origin '\*' is forbidden"):
        prod_wildcard_settings.validate_production_security()

    # Production with SQLite must raise ValueError
    prod_sqlite_settings = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="super_secure_random_production_secret_key_12345",
        CORS_ORIGINS=["https://omnidoc-studio-jet.vercel.app"],
        DATABASE_URL="sqlite+aiosqlite:///./test.db",
        STORAGE_PROVIDER="s3",
        S3_BUCKET_NAME="production-vault-bucket",
        AWS_ACCESS_KEY_ID="AKIA_PROD_KEY_ID",
        AWS_SECRET_ACCESS_KEY="secret_access_key_entropy_12345"
    )
    with pytest.raises(ValueError, match="Production requires a persistent PostgreSQL database"):
        prod_sqlite_settings.validate_production_security()

    # Production with local ephemeral storage must raise ValueError
    prod_local_storage_settings = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="super_secure_random_production_secret_key_12345",
        CORS_ORIGINS=["https://omnidoc-studio-jet.vercel.app"],
        DATABASE_URL="postgresql+asyncpg://user:pass@localhost:5432/omnidoc_prod",
        STORAGE_PROVIDER="local"
    )
    with pytest.raises(ValueError, match="Production requires persistent object storage"):
        prod_local_storage_settings.validate_production_security()

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

