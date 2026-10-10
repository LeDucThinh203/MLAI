"""Call available Gemini generateContent models sequentially until valid JSON is returned."""
from __future__ import annotations

import base64
import json
from typing import Any, Callable

import httpx

from app.services.gemini_models import list_gemini_models, list_gemini_models_sync


def _parse_candidate(response_data: dict[str, Any]) -> dict[str, Any] | None:
    candidates = response_data.get('candidates', [])
    parts = candidates[0].get('content', {}).get('parts', []) if candidates else []
    text = ''.join(part.get('text', '') for part in parts if isinstance(part, dict)).strip()
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


def _body(prompt: str, max_tokens: int, image_bytes: bytes | None, mime_type: str | None) -> dict[str, Any]:
    parts: list[dict[str, Any]] = [{'text': prompt}]
    if image_bytes is not None and mime_type:
        parts.append({'inlineData': {'mimeType': mime_type, 'data': base64.b64encode(image_bytes).decode('ascii')}})
    return {'contents': [{'parts': parts}], 'generationConfig': {
        'responseMimeType': 'application/json', 'temperature': 0.0, 'maxOutputTokens': max_tokens,
    }}


def generate_json_sync(
    prompt: str, api_key: str, *, max_tokens: int = 3000,
    validator: Callable[[dict[str, Any]], bool] | None = None,
    image_bytes: bytes | None = None, mime_type: str | None = None,
) -> tuple[dict[str, Any] | None, str | None, int, str | None]:
    models = list_gemini_models_sync(api_key)
    last_error = 'No Gemini model returned valid JSON'
    calls = 0
    with httpx.Client(timeout=httpx.Timeout(10.0, connect=4.0)) as client:
        for model in models:
            try:
                calls += 1
                response = client.post(
                    f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
                    headers={'x-goog-api-key': api_key},
                    json=_body(prompt, max_tokens, image_bytes, mime_type),
                )
                if response.status_code != 200:
                    last_error = f'{model}: HTTP {response.status_code}'
                    continue
                parsed = _parse_candidate(response.json())
                if parsed is not None and (validator is None or validator(parsed)):
                    return parsed, model, calls, None
                last_error = f'{model}: invalid or incomplete response'
            except Exception as exc:
                last_error = f'{model}: {type(exc).__name__}'
    return None, None, calls, last_error


async def generate_json(
    prompt: str, api_key: str, *, max_tokens: int = 3000,
    validator: Callable[[dict[str, Any]], bool] | None = None,
    image_bytes: bytes | None = None, mime_type: str | None = None,
) -> tuple[dict[str, Any] | None, str | None, int, str | None]:
    models = await list_gemini_models(api_key)
    last_error = 'No Gemini model returned valid JSON'
    calls = 0
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=4.0)) as client:
        for model in models:
            try:
                calls += 1
                response = await client.post(
                    f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
                    headers={'x-goog-api-key': api_key},
                    json=_body(prompt, max_tokens, image_bytes, mime_type),
                )
                if response.status_code != 200:
                    last_error = f'{model}: HTTP {response.status_code}'
                    continue
                parsed = _parse_candidate(response.json())
                if parsed is not None and (validator is None or validator(parsed)):
                    return parsed, model, calls, None
                last_error = f'{model}: invalid or incomplete response'
            except Exception as exc:
                last_error = f'{model}: {type(exc).__name__}'
    return None, None, calls, last_error
