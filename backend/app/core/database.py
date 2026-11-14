import os
import logging
from typing import AsyncGenerator
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.core.config import settings

logger = logging.getLogger("omnidoc.database")

def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)

is_sqlite = "sqlite" in settings.DATABASE_URL.lower()
is_vercel = bool(os.getenv("VERCEL"))

engine_kwargs = {
    "echo": False,
    "future": True,
}

if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
elif is_vercel:
    from sqlalchemy.pool import NullPool
    # On serverless runtimes, NullPool avoids connection state corruption across container freezes
    engine_kwargs["poolclass"] = NullPool
else:
    engine_kwargs["pool_size"] = getattr(settings, "DATABASE_POOL_SIZE", 10)
    engine_kwargs["max_overflow"] = getattr(settings, "DATABASE_MAX_OVERFLOW", 20)
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 1800

# Configure SSL for remote PostgreSQL/Supabase if needed
if not is_sqlite and ("supabase" in settings.DATABASE_URL or "ssl=require" in settings.DATABASE_URL.lower()):
    connect_args = engine_kwargs.get("connect_args", {})
    if "ssl" not in connect_args and "ssl=" not in settings.DATABASE_URL:
        connect_args["ssl"] = "require"
    engine_kwargs["connect_args"] = connect_args

# Engine setup
engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

Base = declarative_base()

_db_initialized = False

async def ensure_db_ready():
    global _db_initialized
    if _db_initialized:
        return
    _db_initialized = True
    import app.models  # ensure models are registered with Base metadata
    
    # Safely create any missing database tables (non-destructive CREATE TABLE IF NOT EXISTS)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        logger.warning(f"ensure_db_ready table synchronization warning: {e}")
            
    try:
        async with AsyncSessionLocal() as session:
            from app.services.seed_data import seed_initial_plans_and_features
            await seed_initial_plans_and_features(session)
            await session.commit()
    except Exception as e:
        logger.warning(f"ensure_db_ready seed data initialization warning: {e}")

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency yielding exactly one database session per request.
    Ensures safe rollback on exception and reliable closure.
    """
    if not _db_initialized:
        await ensure_db_ready()
    
    session: AsyncSession = AsyncSessionLocal()
    try:
        yield session
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()
