import time
from typing import Dict, List, Tuple
from fastapi import Request, HTTPException, status

# In-memory sliding window rate limiter: key -> list of request timestamps
_request_records: Dict[str, List[float]] = {}

def check_rate_limit(
    key: str,
    max_requests: int,
    window_seconds: int
) -> None:
    now = time.time()
    cutoff = now - window_seconds
    
    # Filter out timestamps older than the window
    timestamps = _request_records.get(key, [])
    valid_timestamps = [ts for ts in timestamps if ts > cutoff]
    
    if len(valid_timestamps) >= max_requests:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Maximum {max_requests} requests per {window_seconds} seconds. Please wait before retrying."
        )
        
    valid_timestamps.append(now)
    _request_records[key] = valid_timestamps

def rate_limiter(max_requests: int, window_seconds: int):
    async def dependency(request: Request):
        # Extract client IP
        client_ip = request.client.host if request.client else "unknown_client"
        path = request.url.path
        key = f"{client_ip}:{path}"
        check_rate_limit(key, max_requests, window_seconds)
    return dependency

def clear_rate_limits():
    """Helper for testing environments"""
    global _request_records
    _request_records = {}
