import os
from typing import AsyncGenerator
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.core.config import settings

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
    engine_kwargs["pool_recycle"] = 3600

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
    
    # In development, testing, or sqlite-based runtime, auto-sync tables
    if settings.ENVIRONMENT.lower() not in ("production", "prod") or "sqlite" in settings.DATABASE_URL:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            
        async with AsyncSessionLocal() as session:
            from app.services.seed_data import seed_initial_plans_and_features
            await seed_initial_plans_and_features(session)
            await session.commit()

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    if not _db_initialized and (settings.ENVIRONMENT.lower() not in ("production", "prod") or "sqlite" in settings.DATABASE_URL):
        await ensure_db_ready()
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

