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
    try:
        import app.models # ensure models are registered with Base metadata
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with AsyncSessionLocal() as session:
            try:
                from app.services.seed_data import seed_initial_plans_and_features
                await seed_initial_plans_and_features(session)
            except Exception:
                await session.rollback()
        _db_initialized = True
    except Exception as e:
        import logging
        logging.getLogger("omnidoc.db").warning(f"Database bootstrap notice: {e}")

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

