import os
import logging
from typing import Optional

try:
    import redis.asyncio as redis
except ImportError:  # redis library may not be installed yet
    redis = None

logger = logging.getLogger("omnidoc")

def get_redis() -> Optional["redis.client.Redis"]:
    """Return a Redis client if REDIS_URL is set and redis library is available.
    The client is lazily instantiated and cached.
    """
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        return None
    if redis is None:
        logger.warning("redis-py not installed; Redis features disabled.")
        return None
    # Simple singleton pattern
    if not hasattr(get_redis, "_client"):
        get_redis._client = redis.from_url(redis_url)
    return get_redis._client

