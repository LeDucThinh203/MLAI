import time

login_attempts = {}
MAX_ATTEMPTS = 5
LOCKOUT_MS = 5 * 60 * 1000


def check_rate_limit(key: str) -> dict:
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


def record_failed_attempt(key: str):
    entry = login_attempts.get(key, {'count': 0, 'lockedUntil': None})
    entry['count'] += 1
    if entry['count'] >= MAX_ATTEMPTS:
        entry['lockedUntil'] = time.time() * 1000 + LOCKOUT_MS
    login_attempts[key] = entry


def clear_rate_limit(key: str):
    login_attempts.pop(key, None)
