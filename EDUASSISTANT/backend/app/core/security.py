import hashlib
import time

from app.config import REDIS_KEY_PREFIX
from app.core.redis_client import get_redis

login_attempts = {}
MAX_ATTEMPTS = 5
LOCKOUT_MS = 5 * 60 * 1000


def _rate_limit_keys(key: str) -> tuple[str, str]:
    # Do not store usernames as plaintext Redis keys.
    digest = hashlib.sha256(key.encode('utf-8')).hexdigest()
    return (
        f'{REDIS_KEY_PREFIX}:auth:attempts:{digest}',
        f'{REDIS_KEY_PREFIX}:auth:lock:{digest}',
    )


async def check_rate_limit(key: str) -> dict:
    redis = await get_redis()
    if redis:
        try:
            _, lock_key = _rate_limit_keys(key)
            remaining = await redis.ttl(lock_key)
            if remaining > 0:
                return {'allowed': False, 'remainingSeconds': remaining}
            return {'allowed': True}
        except Exception:
            # Redis is an optimization; retain rate protection locally on errors.
            pass

    entry = login_attempts.get(key)
    if not entry:
        return {'allowed': True}
    now_ts = time.time() * 1000
    if entry.get('lockedUntil') and now_ts < entry['lockedUntil']:
        remaining = int((entry['lockedUntil'] - now_ts) / 1000)
        return {'allowed': False, 'remainingSeconds': remaining}
    if entry.get('lockedUntil') and now_ts >= entry['lockedUntil']:
        login_attempts.pop(key, None)
        return {'allowed': True}
    return {'allowed': True}


async def record_failed_attempt(key: str):
    redis = await get_redis()
    if redis:
        try:
            attempts_key, lock_key = _rate_limit_keys(key)
            await redis.eval(
                """
                local count = redis.call('INCR', KEYS[1])
                if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
                if count >= tonumber(ARGV[2]) then
                    redis.call('SET', KEYS[2], '1', 'EX', ARGV[3])
                    redis.call('DEL', KEYS[1])
                end
                return count
                """,
                2, attempts_key, lock_key,
                LOCKOUT_MS // 1000, MAX_ATTEMPTS, LOCKOUT_MS // 1000,
            )
            return
        except Exception:
            pass

    entry = login_attempts.get(key, {'count': 0, 'lockedUntil': None})
    entry['count'] += 1
    if entry['count'] >= MAX_ATTEMPTS:
        entry['lockedUntil'] = time.time() * 1000 + LOCKOUT_MS
    login_attempts[key] = entry


async def clear_rate_limit(key: str):
    redis = await get_redis()
    if redis:
        try:
            attempts_key, lock_key = _rate_limit_keys(key)
            await redis.delete(attempts_key, lock_key)
            return
        except Exception:
            pass
    login_attempts.pop(key, None)
