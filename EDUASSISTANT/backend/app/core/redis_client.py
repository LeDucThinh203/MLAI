"""Optional Redis connection shared by ephemeral backend concerns.

PostgreSQL remains the source of truth for users, cases, audit records and
refresh tokens. Redis is intentionally used only for short-lived, distributed
state such as login throttling, so an unavailable cache never takes down login.
"""

import time
from typing import Optional

from app.config import REDIS_URL

try:
    from redis.asyncio import Redis
except ImportError:  # Allows a clear fallback before dependencies are installed.
    Redis = None  # type: ignore[assignment,misc]

_client: Optional["Redis"] = None
_retry_after = 0.0


async def get_redis() -> Optional["Redis"]:
    """Return a verified Redis client, or None when Redis is disabled/down."""
    global _client, _retry_after
    if not REDIS_URL or Redis is None or time.monotonic() < _retry_after:
        return None
    if _client is not None:
        return _client
    try:
        candidate = Redis.from_url(
            REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=1,
            socket_timeout=1,
        )
        await candidate.ping()
        _client = candidate
        return _client
    except Exception:
        _retry_after = time.monotonic() + 30
        if 'candidate' in locals():
            await candidate.aclose()
        return None


async def close_redis() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
