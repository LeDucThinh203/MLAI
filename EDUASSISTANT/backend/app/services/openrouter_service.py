"""OpenRouter adapter for optional, free-model fallback requests."""
from __future__ import annotations

import json
import os
from typing import Any

import httpx


def _content_text(content: Any) -> str:
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        return ''.join(
            str(part.get('text', '')) for part in content
            if isinstance(part, dict) and part.get('type') == 'text'
        ).strip()
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


def _model() -> str:
    # Use OpenRouter's free-only router unless explicitly changed by deployment config.
    return os.environ.get('OPENROUTER_MODEL', 'openrouter/free').strip() or 'openrouter/free'


def _request_body(prompt: str, max_tokens: int, image_data_url: str | None) -> dict[str, Any]:
    content: Any = prompt
    if image_data_url:
        content = [
            {'type': 'text', 'text': prompt},
            {'type': 'image_url', 'image_url': {'url': image_data_url}},
        ]
    return {
        'model': _model(),
        'messages': [{'role': 'user', 'content': content}],
        'temperature': 0,
        'max_tokens': max_tokens,
        'response_format': {'type': 'json_object'},
    }


def _headers(api_key: str) -> dict[str, str]:
    return {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'HTTP-Referer': os.environ.get('FRONTEND_URL', 'https://edu-sp.pages.dev'),
        'X-Title': 'EDUASSISTANT',
    }


def generate_json_sync(prompt: str, *, max_tokens: int = 4000) -> tuple[dict[str, Any] | None, str | None]:
    api_key = os.environ.get('OPENROUTER_API_KEY', '').strip()
    if len(api_key) < 10:
        return None, 'OPENROUTER_API_KEY is not configured'
    try:
        with httpx.Client(timeout=httpx.Timeout(20.0, connect=5.0)) as client:
            response = client.post(
                'https://openrouter.ai/api/v1/chat/completions',
                headers=_headers(api_key),
                json=_request_body(prompt, max_tokens, None),
            )
        if response.status_code != 200:
            return None, f'OpenRouter returned HTTP {response.status_code}'
        choices = response.json().get('choices', [])
        message = choices[0].get('message', {}) if choices else {}
        return _parse_json_text(message.get('content')), None
    except Exception as exc:
        return None, f'OpenRouter request failed ({type(exc).__name__})'


async def generate_json(
    prompt: str, *, max_tokens: int = 4000, image_data_url: str | None = None
) -> tuple[dict[str, Any] | None, str | None]:
    api_key = os.environ.get('OPENROUTER_API_KEY', '').strip()
    if len(api_key) < 10:
        return None, 'OPENROUTER_API_KEY is not configured'
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=5.0)) as client:
            response = await client.post(
                'https://openrouter.ai/api/v1/chat/completions',
                headers=_headers(api_key),
                json=_request_body(prompt, max_tokens, image_data_url),
            )
        if response.status_code != 200:
            return None, f'OpenRouter returned HTTP {response.status_code}'
        choices = response.json().get('choices', [])
        message = choices[0].get('message', {}) if choices else {}
        return _parse_json_text(message.get('content')), None
    except Exception as exc:
        return None, f'OpenRouter request failed ({type(exc).__name__})'
