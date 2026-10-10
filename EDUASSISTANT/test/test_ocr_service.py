"""Regression tests for evidence OCR routing and truthful fallback behavior."""
from __future__ import annotations

import base64
import os
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

import pymupdf

BACKEND = os.path.join(os.path.dirname(__file__), '..', 'backend')
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

from app.services import ocr_service, openrouter_service


class OcrServiceTests(unittest.TestCase):
    def test_supported_upload_types_are_identified_by_bytes(self):
        examples = [
            (b'\x89PNG\r\n\x1a\n' + b'0' * 24, 'image/png'),
            (b'\xff\xd8\xff' + b'0' * 24, 'image/jpeg'),
            (b'RIFF' + b'0' * 4 + b'WEBP' + b'0' * 16, 'image/webp'),
            (b'%PDF-1.7\n', 'application/pdf'),
        ]
        for buffer, mime in examples:
            with self.subTest(mime=mime):
                self.assertEqual(ocr_service._mime_from_bytes(buffer), mime)

    def test_pdf_is_rendered_as_at_most_three_image_pages(self):
        document = pymupdf.open()
        for number in range(4):
            page = document.new_page()
            page.insert_text((72, 72), f'Page {number + 1}')
        pdf_bytes = document.tobytes()
        document.close()

        image_pages = ocr_service._openrouter_image_pages(pdf_bytes, 'application/pdf')

        self.assertEqual(len(image_pages), 3)
        self.assertTrue(all(page.startswith('data:image/png;base64,') for page in image_pages))


class AsyncOcrServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_gemini_is_tried_before_openrouter_and_image_is_forwarded(self):
        image = b'\x89PNG\r\n\x1a\n' + b'0' * 24
        gemini = AsyncMock(return_value=(None, None, 1, 'unavailable'))
        openrouter = AsyncMock(return_value=(
            {'rawExtractedText': 'GIẤY XÁC NHẬN SINH VIÊN', 'studentCode': 'SV001'},
            None, 'qwen/qwen3.8-27b:free', 1,
        ))
        with patch.dict(os.environ, {
            'GEMINI_API_KEY': 'configured-gemini-key',
            'OPENROUTER_API_KEY': 'configured-openrouter-key',
        }), patch.object(ocr_service, 'get_ai_mode', return_value='live'), \
             patch.object(ocr_service, 'generate_gemini_json', gemini), \
             patch.object(ocr_service, 'generate_vision_json', openrouter):
            result = await ocr_service.extract_document_entities(image, 'evidence.png')

        self.assertTrue(result['success'])
        self.assertEqual(result['provider'], 'OpenRouter (qwen/qwen3.8-27b:free)')
        gemini.assert_awaited_once()
        openrouter.assert_awaited_once()
        image_url = openrouter.await_args.kwargs['image_data_urls'][0]
        self.assertEqual(image_url, 'data:image/png;base64,' + base64.b64encode(image).decode('ascii'))
        self.assertEqual(result['data']['rawExtractedText'], 'GIẤY XÁC NHẬN SINH VIÊN')
        self.assertFalse(result['data']['isSynthetic'])

    async def test_failed_models_do_not_create_fake_ocr_facts(self):
        gemini = AsyncMock(return_value=(None, None, 1, 'error'))
        openrouter = AsyncMock(return_value=(None, 'error', None, 1))
        with patch.dict(os.environ, {
            'GEMINI_API_KEY': 'configured-gemini-key',
            'OPENROUTER_API_KEY': 'configured-openrouter-key',
        }), patch.object(ocr_service, 'get_ai_mode', return_value='live'), \
             patch.object(ocr_service, 'generate_gemini_json', gemini), \
             patch.object(ocr_service, 'generate_vision_json', openrouter):
            result = await ocr_service.extract_document_entities(
                b'\x89PNG\r\n\x1a\n' + b'0' * 24, 'unknown.png',
                {'fullName': 'Synthetic Student', 'studentCode': 'FAKE-001'},
            )

        self.assertFalse(result['success'])
        self.assertEqual(result['data']['extractionStatus'], 'UNAVAILABLE')
        self.assertEqual(result['data']['rawExtractedText'], '')
        self.assertNotIn('studentName', result['data'])
        self.assertNotIn('studentCode', result['data'])

    async def test_openrouter_ocr_pins_free_vision_model_and_sends_image_parts(self):
        response = MagicMock(status_code=200)
        response.json.return_value = {
            'choices': [{'message': {'content': '{"rawExtractedText":"read"}'}}],
            'model': 'qwen/qwen3.8-27b:free',
        }
        client = AsyncMock()
        client.post.return_value = response
        manager = MagicMock()
        manager.__aenter__ = AsyncMock(return_value=client)
        manager.__aexit__ = AsyncMock(return_value=False)
        with patch.dict(os.environ, {'OPENROUTER_API_KEY': 'configured-openrouter-key'}), \
             patch.object(openrouter_service.httpx, 'AsyncClient', return_value=manager):
            result, error, model, calls = await openrouter_service.generate_vision_json(
                'Transcribe this', image_data_urls=[
                    'data:image/png;base64,AAAA', 'data:image/png;base64,BBBB',
                ],
            )

        self.assertIsNone(error)
        self.assertEqual(result, {'rawExtractedText': 'read'})
        self.assertEqual(model, 'qwen/qwen3.8-27b:free')
        self.assertEqual(calls, 1)
        payload = client.post.await_args.kwargs['json']
        self.assertEqual(payload['model'], 'qwen/qwen3.8-27b:free')
        parts = payload['messages'][0]['content']
        self.assertEqual([part['image_url']['url'] for part in parts[1:]], [
            'data:image/png;base64,AAAA', 'data:image/png;base64,BBBB',
        ])


if __name__ == '__main__':
    unittest.main()
