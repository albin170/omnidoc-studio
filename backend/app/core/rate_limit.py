import os
import time
import logging
from typing import Dict, List, Optional
from fastapi import Request, HTTPException, status

logger = logging.getLogger("omnidoc.rate_limit")

# Centralized in-memory fallback sliding window
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
            logger.warning("Redis initialization failed, using local sliding window: %s", e)
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
            logger.warning("Distributed rate limit check encountered error, using memory fallback: %s", e)

    # In-memory sliding window fallback
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
        # Extract client IP
        client_ip = request.client.host if request.client else "unknown_client"
        path = request.url.path
        key = f"{client_ip}:{path}"
        await check_rate_limit_async(key, max_requests, window_seconds)
    return dependency

def clear_rate_limits():
    """Helper for testing environments"""
    global _request_records
    _request_records = {}

