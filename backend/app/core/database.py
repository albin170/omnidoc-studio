from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.core.config import settings

# Engine setup
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
)

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
    import app.models  # ensure models are registered with Base metadata
    
    # In development, testing, or sqlite-based runtime (e.g. Vercel serverless), auto-sync tables
    if settings.ENVIRONMENT.lower() not in ("production", "prod") or "sqlite" in settings.DATABASE_URL:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            
    # Always ensure default SaaS plans, features, and initial admin/user accounts are present
    async with AsyncSessionLocal() as session:
        from app.services.seed_data import seed_initial_plans_and_features
        await seed_initial_plans_and_features(session)
        await session.commit()
    _db_initialized = True

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    await ensure_db_ready()
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

