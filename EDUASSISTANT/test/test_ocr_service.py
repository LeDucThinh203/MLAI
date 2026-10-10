"""Regression tests for evidence OCR routing and truthful fallback behavior."""
from __future__ import annotations

import base64
import io
import os
import sys
from unittest.mock import AsyncMock, MagicMock

import fitz
import pytest

BACKEND = os.path.join(os.path.dirname(__file__), '..', 'backend')
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

from app.services import ocr_service, openrouter_service


@pytest.mark.parametrize(('buffer', 'mime'), [
    (b'\x89PNG\r\n\x1a\n' + b'0' * 24, 'image/png'),
    (b'\xff\xd8\xff' + b'0' * 24, 'image/jpeg'),
    (b'RIFF' + b'0' * 4 + b'WEBP' + b'0' * 16, 'image/webp'),
    (b'%PDF-1.7\n', 'application/pdf'),
])
def test_supported_upload_types_are_identified_by_bytes(buffer, mime):
    assert ocr_service._mime_from_bytes(buffer) == mime


def test_pdf_is_rendered_as_at_most_three_image_pages():
    document = fitz.open()
    for number in range(4):
        page = document.new_page()
        page.insert_text((72, 72), f'Page {number + 1}')
    pdf_bytes = document.tobytes()
    document.close()

    image_pages = ocr_service._openrouter_image_pages(pdf_bytes, 'application/pdf')

    assert len(image_pages) == 3
    assert all(page.startswith('data:image/png;base64,') for page in image_pages)


@pytest.mark.asyncio
async def test_gemini_is_tried_before_openrouter_and_image_is_forwarded(monkeypatch):
    monkeypatch.setattr(ocr_service, 'get_ai_mode', lambda: 'live')
    monkeypatch.setenv('GEMINI_API_KEY', 'configured-gemini-key')
    monkeypatch.setenv('OPENROUTER_API_KEY', 'configured-openrouter-key')
    gemini = AsyncMock(return_value=(None, None, 1, 'unavailable'))
    openrouter = AsyncMock(return_value=(
        {'rawExtractedText': 'GIẤY XÁC NHẬN SINH VIÊN', 'studentCode': 'SV001'},
        None, 'qwen/qwen3.8-27b:free', 1,
    ))
    monkeypatch.setattr(ocr_service, 'generate_gemini_json', gemini)
    monkeypatch.setattr(ocr_service, 'generate_vision_json', openrouter)
    image = b'\x89PNG\r\n\x1a\n' + b'0' * 24

    result = await ocr_service.extract_document_entities(image, 'evidence.png')

    assert result['success'] is True
    assert result['provider'] == 'OpenRouter (qwen/qwen3.8-27b:free)'
    gemini.assert_awaited_once()
    openrouter.assert_awaited_once()
    image_url = openrouter.await_args.kwargs['image_data_urls'][0]
    assert image_url == 'data:image/png;base64,' + base64.b64encode(image).decode('ascii')
    assert result['data']['rawExtractedText'] == 'GIẤY XÁC NHẬN SINH VIÊN'
    assert result['data']['isSynthetic'] is False


@pytest.mark.asyncio
async def test_failed_models_do_not_create_fake_ocr_facts(monkeypatch):
    monkeypatch.setattr(ocr_service, 'get_ai_mode', lambda: 'live')
    monkeypatch.setenv('GEMINI_API_KEY', 'configured-gemini-key')
    monkeypatch.setenv('OPENROUTER_API_KEY', 'configured-openrouter-key')
    monkeypatch.setattr(ocr_service, 'generate_gemini_json', AsyncMock(return_value=(None, None, 1, 'error')))
    monkeypatch.setattr(ocr_service, 'generate_vision_json', AsyncMock(return_value=(None, 'error', None, 1)))

    result = await ocr_service.extract_document_entities(
        b'\x89PNG\r\n\x1a\n' + b'0' * 24, 'unknown.png',
        {'fullName': 'Synthetic Student', 'studentCode': 'FAKE-001'},
    )

    assert result['success'] is False
    assert result['data']['extractionStatus'] == 'UNAVAILABLE'
    assert result['data']['rawExtractedText'] == ''
    assert 'studentName' not in result['data']
    assert 'studentCode' not in result['data']


@pytest.mark.asyncio
async def test_openrouter_ocr_pins_free_vision_model_and_sends_image_parts(monkeypatch):
    monkeypatch.setenv('OPENROUTER_API_KEY', 'configured-openrouter-key')
    response = MagicMock(status_code=200)
    response.json.return_value = {'choices': [{'message': {'content': '{"rawExtractedText":"read"}'}}],
                                  'model': 'qwen/qwen3.8-27b:free'}
    client = AsyncMock()
    client.post.return_value = response
    manager = MagicMock()
    manager.__aenter__ = AsyncMock(return_value=client)
    manager.__aexit__ = AsyncMock(return_value=False)
    monkeypatch.setattr(openrouter_service.httpx, 'AsyncClient', lambda **_: manager)

    result, error, model, calls = await openrouter_service.generate_vision_json(
        'Transcribe this', image_data_urls=['data:image/png;base64,AAAA', 'data:image/png;base64,BBBB'],
    )

    assert error is None
    assert result == {'rawExtractedText': 'read'}
    assert model == 'qwen/qwen3.8-27b:free'
    assert calls == 1
    payload = client.post.await_args.kwargs['json']
    assert payload['model'] == 'qwen/qwen3.8-27b:free'
    parts = payload['messages'][0]['content']
    assert [part['image_url']['url'] for part in parts[1:]] == [
        'data:image/png;base64,AAAA', 'data:image/png;base64,BBBB',
    ]
