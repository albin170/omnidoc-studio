import uuid
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine, Base
import app.models  # Ensure all models are registered with metadata
from app.api.v1 import (
    auth,
    documents,
    jobs,
    tools,
    audit,
    search,
    organizations,
    users,
    admin,
    developer,
    workflows,
    simulation,
    plans,
    user_portal,
    billing,
    messages,
    announcements,
)

logger = logging.getLogger("omnidoc")

@asynccontextmanager
async def lifespan(app: FastAPI):
    if not settings.is_vercel:
        from app.core.database import ensure_db_ready
        await ensure_db_ready()
    yield
    if not settings.is_vercel:
        await engine.dispose()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="2.0.0",
    description="Enterprise-grade Autonomous Document Engineering Platform with canonical Document Digital Twin, constrained agent execution, typed tool registry, and cryptographic verification.",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)

# Correlation ID Middleware
@app.middleware("http")
async def correlation_id_middleware(request: Request, call_next):
    correlation_id = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
    request.state.correlation_id = correlation_id
    response = await call_next(request)
    response.headers["X-Correlation-ID"] = correlation_id
    return response

# Global Exception Handler (Phase 3.3)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    correlation_id = getattr(request.state, "correlation_id", str(uuid.uuid4()))
    logger.error("Unhandled server exception [corr_id=%s]: %s", correlation_id, exc, exc_info=True)
    
    if settings.ENVIRONMENT.lower() in ("production", "prod"):
        return JSONResponse(
            status_code=500,
            content={
                "detail": "An internal server error occurred. Please contact support with the correlation ID.",
                "correlation_id": correlation_id
            },
            headers={"X-Correlation-ID": correlation_id}
        )
    return JSONResponse(
        status_code=500,
        content={
            "detail": str(exc),
            "correlation_id": correlation_id,
            "error_type": exc.__class__.__name__
        },
        headers={"X-Correlation-ID": correlation_id}
    )

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(documents.router, prefix=settings.API_V1_STR)
app.include_router(jobs.router, prefix=settings.API_V1_STR)
app.include_router(tools.router, prefix=settings.API_V1_STR)
app.include_router(audit.router, prefix=settings.API_V1_STR)
app.include_router(search.router, prefix=settings.API_V1_STR)
app.include_router(organizations.router, prefix=settings.API_V1_STR)
app.include_router(users.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)
app.include_router(developer.router, prefix=settings.API_V1_STR)
app.include_router(workflows.router, prefix=settings.API_V1_STR)
app.include_router(simulation.router, prefix=settings.API_V1_STR)
app.include_router(plans.router, prefix=settings.API_V1_STR)
app.include_router(user_portal.router, prefix=settings.API_V1_STR)
app.include_router(billing.router, prefix=settings.API_V1_STR)
app.include_router(messages.router, prefix=settings.API_V1_STR)
app.include_router(announcements.router, prefix=settings.API_V1_STR)

@app.get("/health", tags=["Health"])
@app.get("/healthz", tags=["Health"]) 
async def healthz():
    """Basic liveness check."""
    return {"status": "ok", "service": "omnidoc-backend"}

@app.get(f"{settings.API_V1_STR}/ready", tags=["Health"]) 
async def ready():
    """Check DB connectivity and optional Redis."""
    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        db_status = "up"
    except Exception as e:
        db_status = f"error: {e}"
    # Check Redis if configured
    try:
        from app.core.redis_client import get_redis
        redis = get_redis()
        if redis:
            await redis.ping()
            redis_status = "up"
        else:
            redis_status = "not_configured"
    except Exception as e:
        redis_status = f"error: {e}"

    is_healthy = db_status == "up"
    payload = {
        "status": "ready" if is_healthy else "not_ready",
        "database": db_status,
        "redis": redis_status
    }
    if not is_healthy:
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content=payload)
    return payload

@app.get(f"{settings.API_V1_STR}/health", tags=["Health"]) 
async def health_check():
    return {
        "status": "healthy",
        "platform": "OmniDoc Studio 2.0 Autonomous Engine",
        "version": "2.0.0",
        "storage": "vault_isolated",
        "mode": "hybrid",
    }
