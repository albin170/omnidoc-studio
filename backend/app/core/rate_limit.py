import os
import time
import logging
from typing import Dict, List, Optional
from fastapi import Request, HTTPException, status
from app.core.config import settings

logger = logging.getLogger("omnidoc.rate_limit")

# Centralized in-memory fallback sliding window (development & testing only)
_request_records: Dict[str, List[float]] = {}
_redis_client = None

def _get_redis_client():
    global _redis_client
    redis_url = os.getenv("REDIS_URL")
    if redis_url and _redis_client is None:
        try:
            import redis.asyncio as aioredis
            _redis_client = aioredis.from_url(redis_url, encoding="utf-8", decode_responses=True)
            logger.info("Connected to distributed Redis for shared rate limiting.")
        except Exception as e:
            logger.warning("Redis initialization failed: %s", e)
            _redis_client = None
    return _redis_client

async def check_rate_limit_async(
    key: str,
    max_requests: int,
    window_seconds: int
) -> None:
    now = time.time()
    cutoff = now - window_seconds
    client = _get_redis_client()
    is_prod = settings.ENVIRONMENT.lower() in ("production", "prod")

    if client:
        try:
            redis_key = f"ratelimit:{key}"
            pipe = client.pipeline()
            pipe.zremrangebyscore(redis_key, 0, cutoff)
            pipe.zcard(redis_key)
            pipe.zadd(redis_key, {str(now): now})
            pipe.expire(redis_key, window_seconds + 5)
            results = await pipe.execute()
            current_count = results[1]

            if current_count >= max_requests:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded. Maximum {max_requests} requests per {window_seconds} seconds. Please wait before retrying.",
                    headers={"Retry-After": str(window_seconds)}
                )
            return
        except HTTPException:
            raise
        except Exception as e:
            if is_prod:
                logger.error("Production Redis rate limiter error: %s", e)
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Distributed rate limiter service temporarily unavailable in production."
                )
            logger.warning("Distributed rate limit check encountered error, using dev memory fallback: %s", e)

    # In production, silent fallback to process-local memory is forbidden
    if is_prod:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Production rate limiter configuration error: REDIS_URL must be configured."
        )

    # In-memory sliding window fallback for development and testing
    timestamps = _request_records.get(key, [])
    valid_timestamps = [ts for ts in timestamps if ts > cutoff]
    
    if len(valid_timestamps) >= max_requests:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Maximum {max_requests} requests per {window_seconds} seconds. Please wait before retrying.",
            headers={"Retry-After": str(window_seconds)}
        )
        
    valid_timestamps.append(now)
    _request_records[key] = valid_timestamps

def check_rate_limit(key: str, max_requests: int, window_seconds: int) -> None:
    """Synchronous rate check for non-async caller compatibility"""
    now = time.time()
    cutoff = now - window_seconds
    timestamps = _request_records.get(key, [])
    valid_timestamps = [ts for ts in timestamps if ts > cutoff]
    if len(valid_timestamps) >= max_requests:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Maximum {max_requests} requests per {window_seconds} seconds.",
            headers={"Retry-After": str(window_seconds)}
        )
    valid_timestamps.append(now)
    _request_records[key] = valid_timestamps

def rate_limiter(max_requests: int, window_seconds: int):
    async def dependency(request: Request):
        # Only trust forwarded headers if incoming connection is from a configured trusted proxy or TRUST_PROXY_HEADERS is enabled
        client_host = request.client.host if request.client else None
        forwarded = request.headers.get("x-forwarded-for")
        cf_ip = request.headers.get("cf-connecting-ip")

        is_trusted_proxy = settings.TRUST_PROXY_HEADERS or (client_host and client_host in settings.TRUSTED_PROXIES)

        if is_trusted_proxy and forwarded:
            client_ip = forwarded.split(",")[0].strip()
        elif is_trusted_proxy and cf_ip:
            client_ip = cf_ip.strip()
        elif client_host:
            client_ip = client_host
        else:
            client_ip = "unknown_client"

        path = request.url.path
        key = f"{client_ip}:{path}"
        await check_rate_limit_async(key, max_requests, window_seconds)
    return dependency

def clear_rate_limits():
    """Helper for testing environments"""
    global _request_records
    _request_records = {}

