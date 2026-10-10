"""OpenRouter fallbacks for text and explicitly free vision OCR."""
from __future__ import annotations

import json
import os
import time
from typing import Any, Callable

import httpx


_MODEL_CACHE: dict[tuple[bool], tuple[float, list[str]]] = {}
_CACHE_SECONDS = 1800
_OPENROUTER_FREE_VISION_OCR_MODEL = 'qwen/qwen3.8-27b:free'
_ROUTER_MODEL = 'openrouter/free'


def _content_text(content: Any) -> str:
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        return ''.join(str(part.get('text', '')) for part in content
                       if isinstance(part, dict) and part.get('type') == 'text').strip()
    return ''


def _parse_json_text(content: Any) -> dict[str, Any] | None:
    text = _content_text(content)
    if text.startswith('```json'):
        text = text[7:]
    elif text.startswith('```'):
        text = text[3:]
    if text.endswith('```'):
        text = text[:-3]
    try:
        parsed = json.loads(text.strip())
        return parsed if isinstance(parsed, dict) else None
    except (TypeError, ValueError):
        return None


def _headers(api_key: str) -> dict[str, str]:
    return {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'HTTP-Referer': os.environ.get('FRONTEND_URL', 'https://edu-sp.pages.dev'),
        'X-Title': 'EDUASSISTANT',
    }


def _pricing_is_free(model: dict[str, Any], *, vision: bool) -> bool:
    pricing = model.get('pricing') or {}
    try:
        if float(pricing.get('prompt', -1)) != 0 or float(pricing.get('completion', -1)) != 0:
            return False
        if 'request' in pricing and float(pricing['request']) != 0:
            return False
        if vision and float(pricing.get('image', -1)) != 0:
            return False
    except (TypeError, ValueError):
        return False
    return True


def _fetch_models(client: httpx.Client, api_key: str, *, vision: bool) -> list[str]:
    cache_key = (vision,)
    cached = _MODEL_CACHE.get(cache_key)
    if cached and time.monotonic() - cached[0] < _CACHE_SECONDS:
        return list(cached[1])

    try:
        response = client.get(
            'https://openrouter.ai/api/v1/models',
            headers=_headers(api_key),
            params={'max_price': 0, 'sort': 'most-popular', 'input_modalities': 'image' if vision else 'text'},
        )
        response.raise_for_status()
        models = response.json().get('data', [])
        ids = []
        for model in models:
            if not isinstance(model, dict) or not _pricing_is_free(model, vision=vision):
                continue
            model_id = model.get('id')
            if not isinstance(model_id, str):
                continue
            ids.append(model_id)
        # Keep OpenRouter's most-popular ordering while removing duplicates.
        ids = list(dict.fromkeys(ids))
        if ids:
            _MODEL_CACHE[cache_key] = (time.monotonic(), ids)
            return ids
    except Exception:
        pass

    return []


def _request_body(model: str, prompt: str, max_tokens: int,
                  image_data_url: str | None,
                  image_data_urls: list[str] | None = None) -> dict[str, Any]:
    content: Any = prompt
    image_urls = image_data_urls or ([image_data_url] if image_data_url else [])
    if image_urls:
        content = [
            {'type': 'text', 'text': prompt},
            *[{'type': 'image_url', 'image_url': {'url': url}} for url in image_urls],
        ]
    return {
        'model': model,
        'messages': [{'role': 'user', 'content': content}],
        'temperature': 0,
        'max_tokens': max_tokens,
    }


async def generate_vision_json(
    prompt: str, *, image_data_urls: list[str], max_tokens: int = 2500,
    validator: Callable[[dict[str, Any]], bool] | None = None,
) -> tuple[dict[str, Any] | None, str | None, str | None, int]:
    """Use one named :free vision model, so OCR cannot silently incur model charges."""
    api_key = os.environ.get('OPENROUTER_API_KEY', '').strip()
    if len(api_key) < 10:
        return None, 'OPENROUTER_API_KEY is not configured', None, 0
    # Pin OCR to a verified free vision model; do not allow paid or text-only models here.
    model = _OPENROUTER_FREE_VISION_OCR_MODEL
    if not image_data_urls:
        return None, 'No image pages were provided for OCR', model, 0
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(35.0, connect=8.0)) as client:
            response = await client.post(
                'https://openrouter.ai/api/v1/chat/completions', headers=_headers(api_key),
                json=_request_body(model, prompt, max_tokens, None, image_data_urls),
            )
            if response.status_code != 200:
                return None, f'{model}: HTTP {response.status_code}', model, 1
            body = response.json()
            choices = body.get('choices', [])
            content = choices[0].get('message', {}).get('content') if choices else None
            parsed = _parse_json_text(content)
            if parsed is not None and (validator is None or validator(parsed)):
                return parsed, None, body.get('model') or model, 1
            return None, f'{model}: empty, invalid, or incomplete OCR response', model, 1
    except Exception as exc:
        return None, f'OpenRouter vision request failed ({type(exc).__name__})', model, 1


def generate_json_sync(
    prompt: str, *, max_tokens: int = 4000, validator: Callable[[dict[str, Any]], bool] | None = None,
) -> tuple[dict[str, Any] | None, str | None, str | None, int]:
    api_key = os.environ.get('OPENROUTER_API_KEY', '').strip()
    if len(api_key) < 10:
        return None, 'OPENROUTER_API_KEY is not configured', None, 0
    errors = []
    calls = 0
    try:
        with httpx.Client(timeout=httpx.Timeout(8.0, connect=4.0)) as client:
            for model in _fetch_models(client, api_key, vision=False):
                try:
                    calls += 1
                    response = client.post(
                        'https://openrouter.ai/api/v1/chat/completions', headers=_headers(api_key),
                        json=_request_body(model, prompt, max_tokens, None),
                    )
                    if response.status_code != 200:
                        errors.append(f'{model}: HTTP {response.status_code}')
                        continue
                    body = response.json()
                    choices = body.get('choices', [])
                    content = choices[0].get('message', {}).get('content') if choices else None
                    parsed = _parse_json_text(content)
                    if parsed is not None and (validator is None or validator(parsed)):
                        return parsed, None, body.get('model') or model, calls
                    errors.append(f'{model}: invalid or incomplete JSON response')
                except Exception as exc:
                    errors.append(f'{model}: {type(exc).__name__}')
    except Exception as exc:
        errors.append(f'OpenRouter request failed ({type(exc).__name__})')
    return None, '; '.join(errors[-5:]) or 'No zero-priced OpenRouter models were available', None, calls


async def generate_json(
    prompt: str, *, max_tokens: int = 4000, image_data_url: str | None = None,
    validator: Callable[[dict[str, Any]], bool] | None = None,
) -> tuple[dict[str, Any] | None, str | None, str | None, int]:
    api_key = os.environ.get('OPENROUTER_API_KEY', '').strip()
    if len(api_key) < 10:
        return None, 'OPENROUTER_API_KEY is not configured', None, 0
    errors = []
    calls = 0
    try:
        # Discover models through an authenticated client, then attempt each model in order.
        async with httpx.AsyncClient(timeout=httpx.Timeout(8.0, connect=4.0)) as client:
            cache_key = (bool(image_data_url),)
            cached = _MODEL_CACHE.get(cache_key)
            if cached and time.monotonic() - cached[0] < _CACHE_SECONDS:
                models = list(cached[1])
            else:
                try:
                    listing = await client.get(
                        'https://openrouter.ai/api/v1/models', headers=_headers(api_key),
                        params={'max_price': 0, 'sort': 'most-popular',
                                'input_modalities': 'image' if image_data_url else 'text'},
                    )
                    listing.raise_for_status()
                    candidates = listing.json().get('data', [])
                    models = []
                    for candidate in candidates:
                        if not isinstance(candidate, dict) or not _pricing_is_free(candidate, vision=bool(image_data_url)):
                            continue
                        model_id = candidate.get('id')
                        if isinstance(model_id, str) and model_id != _ROUTER_MODEL:
                            models.append(model_id)
                    models = list(dict.fromkeys(models))
                    if models:
                        _MODEL_CACHE[cache_key] = (time.monotonic(), models)
                except Exception:
                    models = []
            for model in models:
                try:
                    calls += 1
                    response = await client.post(
                        'https://openrouter.ai/api/v1/chat/completions', headers=_headers(api_key),
                        json=_request_body(model, prompt, max_tokens, image_data_url),
                    )
                    if response.status_code != 200:
                        errors.append(f'{model}: HTTP {response.status_code}')
                        continue
                    body = response.json()
                    choices = body.get('choices', [])
                    content = choices[0].get('message', {}).get('content') if choices else None
                    parsed = _parse_json_text(content)
                    if parsed is not None and (validator is None or validator(parsed)):
                        return parsed, None, body.get('model') or model, calls
                    errors.append(f'{model}: invalid or incomplete JSON response')
                except Exception as exc:
                    errors.append(f'{model}: {type(exc).__name__}')
    except Exception as exc:
        errors.append(f'OpenRouter request failed ({type(exc).__name__})')
    return None, '; '.join(errors[-5:]) or 'No zero-priced OpenRouter models were available', None, calls
