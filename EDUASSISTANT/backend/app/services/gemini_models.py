"""Discover every Gemini model exposed to this key that supports generateContent."""
from __future__ import annotations

import os
import time

import httpx


_CACHE: dict[str, tuple[float, list[str]]] = {}
_CACHE_SECONDS = 1800
_KNOWN_FALLBACKS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite']


def _sort_models(names: list[str]) -> list[str]:
    unique = list(dict.fromkeys(names))
    preferred = [os.environ.get('GEMINI_TEXT_MODEL', '').strip(), *_KNOWN_FALLBACKS]
    preferred = [name for name in preferred if name]
    ordered = [name for name in preferred if name in unique]
    ordered.extend(sorted(name for name in unique if name not in ordered))
    return ordered


def _extract(response_data: dict) -> list[str]:
    names = []
    for model in response_data.get('models', []):
        if not isinstance(model, dict) or 'generateContent' not in (model.get('supportedGenerationMethods') or []):
            continue
        name = str(model.get('name', '')).removeprefix('models/')
        if name.startswith('gemini-'):
            names.append(name)
    return names


def list_gemini_models_sync(api_key: str) -> list[str]:
    cached = _CACHE.get(api_key)
    if cached and time.monotonic() - cached[0] < _CACHE_SECONDS:
        return list(cached[1])
    names = []
    page_token = None
    try:
        with httpx.Client(timeout=httpx.Timeout(8.0, connect=4.0)) as client:
            for _ in range(20):
                params = {'pageSize': 1000}
                if page_token:
                    params['pageToken'] = page_token
                response = client.get(
                    'https://generativelanguage.googleapis.com/v1beta/models',
                    headers={'x-goog-api-key': api_key}, params=params,
                )
                response.raise_for_status()
                data = response.json()
                names.extend(_extract(data))
                page_token = data.get('nextPageToken')
                if not page_token:
                    break
    except Exception:
        names = []
    ordered = _sort_models(names or _KNOWN_FALLBACKS)
    _CACHE[api_key] = (time.monotonic(), ordered)
    return ordered


async def list_gemini_models(api_key: str) -> list[str]:
    cached = _CACHE.get(api_key)
    if cached and time.monotonic() - cached[0] < _CACHE_SECONDS:
        return list(cached[1])
    names = []
    page_token = None
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(8.0, connect=4.0)) as client:
            for _ in range(20):
                params = {'pageSize': 1000}
                if page_token:
                    params['pageToken'] = page_token
                response = await client.get(
                    'https://generativelanguage.googleapis.com/v1beta/models',
                    headers={'x-goog-api-key': api_key}, params=params,
                )
                response.raise_for_status()
                data = response.json()
                names.extend(_extract(data))
                page_token = data.get('nextPageToken')
                if not page_token:
                    break
    except Exception:
        names = []
    ordered = _sort_models(names or _KNOWN_FALLBACKS)
    _CACHE[api_key] = (time.monotonic(), ordered)
    return ordered
