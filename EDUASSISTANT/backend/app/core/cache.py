"""Small Redis JSON cache with versioned namespaces for safe invalidation."""

import hashlib
import json
from typing import Any, Optional

from app.config import REDIS_KEY_PREFIX
from app.core.redis_client import get_redis


def _key(namespace: str, identity: Any, version: str) -> str:
    encoded = json.dumps(identity, sort_keys=True, separators=(',', ':'), default=str)
    digest = hashlib.sha256(encoded.encode('utf-8')).hexdigest()
    return f'{REDIS_KEY_PREFIX}:cache:{namespace}:v{version}:{digest}'


async def get_cache_version(namespace: str) -> str:
    redis = await get_redis()
    if not redis:
        return '0'
    try:
        return await redis.get(f'{REDIS_KEY_PREFIX}:cache-version:{namespace}') or '0'
    except Exception:
        return '0'


async def bump_cache_version(namespace: str) -> None:
    redis = await get_redis()
    if not redis:
        return
    try:
        await redis.incr(f'{REDIS_KEY_PREFIX}:cache-version:{namespace}')
    except Exception:
        return


async def get_json(namespace: str, identity: Any) -> Optional[Any]:
    redis = await get_redis()
    if not redis:
        return None
    try:
        value = await redis.get(_key(namespace, identity, await get_cache_version(namespace)))
        return json.loads(value) if value else None
    except Exception:
        return None


async def set_json(namespace: str, identity: Any, value: Any, ttl_seconds: int) -> None:
    redis = await get_redis()
    if not redis:
        return
    try:
        version = await get_cache_version(namespace)
        await redis.set(_key(namespace, identity, version), json.dumps(value, ensure_ascii=False), ex=ttl_seconds)
    except Exception:
        return
