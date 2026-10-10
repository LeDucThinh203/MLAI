from __future__ import annotations

import json
import os
from typing import Any

import httpx

from app.services.openrouter_service import generate_json_sync


FALLBACK_MESSAGE = 'Both live AI providers failed; using prepared synthetic benchmark fixtures.'
REQUIRED_PARTS = {'houseNumber', 'street', 'ward', 'district', 'province'}


def _validated_results(response: Any, cases: list[dict[str, Any]]) -> dict[str, dict[str, Any]] | None:
    if not isinstance(response, dict) or not isinstance(response.get('results'), list):
        return None
    expected_ids = {str(item['id']) for item in cases}
    by_id: dict[str, dict[str, Any]] = {}
    for item in response['results']:
        if not isinstance(item, dict):
            continue
        case_id = str(item.get('caseId', ''))
        parsed = item.get('parsed')
        normalized = item.get('normalized')
        missing = item.get('missingFields')
        confidence = item.get('confidence')
        parsed_is_valid = (
            isinstance(parsed, dict) and REQUIRED_PARTS.issubset(parsed)
            and all(parsed[key] is None or isinstance(parsed[key], str) for key in REQUIRED_PARTS)
        )
        if (case_id in expected_ids and parsed_is_valid and isinstance(normalized, str)
                and isinstance(missing, list) and isinstance(confidence, (int, float))
                and not isinstance(confidence, bool) and 0 <= confidence <= 1
                and isinstance(item.get('isComplete'), bool)):
            by_id[case_id] = {
                'parsed': parsed, 'normalized': normalized,
                'missingFields': [str(value) for value in missing],
                'confidence': float(confidence), 'isComplete': item['isComplete'],
            }
    return by_id if set(by_id) == expected_ids else None


def _apply_live_results(cases: list[dict[str, Any]], by_id: dict[str, dict[str, Any]],
                        provider: str, model: str) -> None:
    for case in cases:
        claim = case.get('studentClaim') or {}
        case_id = str(case['id'])
        case['addressAnalysis'] = {
            **by_id[case_id],
            'rawAddress': claim.get('declaredAddress') or claim.get('rawAddress') or case.get('description') or '',
            'source': provider.lower().replace(' ', '_'),
        }
        case['aiMetadata'] = {
            'modeUsed': 'live', 'isLive': True, 'isFallback': False,
            'fallbackOccurred': False, 'isSynthetic': False,
            'provider': provider, 'model': model,
        }


def enrich_benchmark_cases(cases: list[dict[str, Any]]) -> dict[str, Any]:
    """Try Gemini, then OpenRouter, then the prepared synthetic fixtures."""
    fixtures = []
    for case in cases:
        claim = case.get('studentClaim') or {}
        address = claim.get('declaredAddress') or claim.get('rawAddress') or case.get('description') or ''
        fixtures.append({'caseId': case.get('id'), 'addressType': claim.get('addressType', 'PERMANENT'), 'address': address})

    prompt = (
        'Bạn là bước trích xuất địa chỉ trong luồng kiểm tra hồ sơ EDUASSISTANT. '
        'Tất cả tình huống bên dưới là dữ liệu tổng hợp để kiểm thử. Với từng caseId, '
        'chỉ phân tích địa chỉ được khai báo; không suy đoán dữ liệu còn thiếu, không xác nhận tính pháp lý, '
        'không quyết định duyệt hồ sơ. Chuẩn hóa cách viết nhưng giữ nguyên địa danh theo nội dung có thể xác định. '
        'Nếu địa chỉ trống hoặc thiếu thành phần, ghi rõ missingFields và không tự điền. '
        'Trả JSON duy nhất theo dạng {"results":[{"caseId":"...","parsed":{"houseNumber":null,"street":null,"ward":null,"district":null,"province":null},'
        '"normalized":"...","missingFields":[],"confidence":0.0,"isComplete":false}]}. '
        'Phải trả đúng một kết quả cho từng caseId.\nDữ liệu:\n' + json.dumps(fixtures, ensure_ascii=False)
    )
    api_calls = 0
    last_error = 'Gemini is unavailable or returned an invalid response'

    api_key = os.environ.get('GEMINI_API_KEY', '').strip()
    if len(api_key) >= 10:
        models = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite']
        try:
            with httpx.Client(timeout=httpx.Timeout(12.0, connect=4.0)) as client:
                for model in models:
                    try:
                        api_calls += 1
                        response = client.post(
                            f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
                            params={'key': api_key},
                            json={'contents': [{'parts': [{'text': prompt}]}], 'generationConfig': {
                                'responseMimeType': 'application/json', 'temperature': 0.0, 'maxOutputTokens': 6000}},
                        )
                        if response.status_code != 200:
                            last_error = f'Gemini returned HTTP {response.status_code}'
                            continue
                        parsed = json.loads(''.join(part.get('text', '') for part in
                            response.json().get('candidates', [{}])[0].get('content', {}).get('parts', [])).strip())
                        by_id = _validated_results(parsed, cases)
                        if by_id is None:
                            last_error = 'Gemini returned incomplete or invalid fields'
                            continue
                        _apply_live_results(cases, by_id, 'Google Gemini', model)
                        return {'mode': 'GEMINI_LIVE', 'provider': 'Google Gemini', 'model': model,
                                'apiCalls': api_calls, 'fallbackReason': None}
                    except Exception as exc:
                        last_error = f'Gemini request failed ({type(exc).__name__})'
        except Exception as exc:
            last_error = f'Gemini request failed ({type(exc).__name__})'
    else:
        last_error = 'GEMINI_API_KEY is not configured'

    openrouter_key = os.environ.get('OPENROUTER_API_KEY', '').strip()
    if len(openrouter_key) >= 10:
        api_calls += 1
        parsed, openrouter_error = generate_json_sync(prompt, max_tokens=6000)
        by_id = _validated_results(parsed, cases)
        if by_id is not None:
            model = os.environ.get('OPENROUTER_MODEL', 'openrouter/free').strip() or 'openrouter/free'
            _apply_live_results(cases, by_id, 'OpenRouter', model)
            return {'mode': 'OPENROUTER_LIVE', 'provider': 'OpenRouter', 'model': model,
                    'apiCalls': api_calls, 'fallbackReason': None}
        last_error = openrouter_error or 'OpenRouter returned incomplete or invalid fields'

    for case in cases:
        metadata = dict(case.get('aiMetadata') or {})
        metadata.update({'modeUsed': 'mock', 'isLive': False, 'isFallback': True,
                         'fallbackOccurred': True, 'isSynthetic': True,
                         'provider': 'synthetic fixture'})
        case['aiMetadata'] = metadata
        address_analysis = case.get('addressAnalysis')
        if isinstance(address_analysis, dict):
            address_analysis['source'] = 'mock'
    return {'mode': 'MOCK_FALLBACK', 'provider': 'synthetic fixture', 'model': None,
            'apiCalls': api_calls, 'fallbackReason': f'{FALLBACK_MESSAGE} {last_error}.'}
