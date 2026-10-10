from __future__ import annotations

import json
import os
from typing import Any

import httpx


FALLBACK_MESSAGE = 'Gemini chưa trả lời hợp lệ; đã dùng dữ liệu mẫu có sẵn.'


def enrich_benchmark_cases(cases: list[dict[str, Any]]) -> dict[str, Any]:
    """Ask Gemini to extract address facts for the 18 synthetic benchmark cases.

    The benchmark's prepared addressAnalysis is used only when Gemini cannot be
    called or its complete batch response cannot be validated.
    """
    api_key = os.environ.get('GEMINI_API_KEY', '').strip()
    if len(api_key) < 10:
        return {'mode': 'MOCK_FALLBACK', 'provider': 'synthetic fixture', 'model': None,
                'apiCalls': 0, 'fallbackReason': 'GEMINI_API_KEY is not configured'}

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

    models = ['gemini-3.8-flash', 'gemini-3.6-flash']
    api_calls = 0
    last_error = 'Gemini did not return a valid response'
    try:
        # Two bounded attempts keep the web request responsive while allowing
        # one model fallback before switching to the prepared mock fixtures.
        with httpx.Client(timeout=httpx.Timeout(12.0, connect=4.0)) as client:
            for model in models:
                try:
                    api_calls += 1
                    response = client.post(
                        f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
                        params={'key': api_key},
                        json={
                            'contents': [{'parts': [{'text': prompt}]}],
                            'generationConfig': {
                                'responseMimeType': 'application/json',
                                'temperature': 0.0,
                                'maxOutputTokens': 6000,
                            },
                        },
                    )
                    if response.status_code != 200:
                        last_error = f'Gemini returned HTTP {response.status_code}'
                        continue
                    candidates = response.json().get('candidates', [])
                    parts = candidates[0].get('content', {}).get('parts', []) if candidates else []
                    text = ''.join(part.get('text', '') for part in parts).strip()
                    parsed_response = json.loads(text)
                    results = parsed_response.get('results')
                    expected_ids = {str(item['id']) for item in cases}
                    if not isinstance(results, list):
                        last_error = 'Gemini response did not contain a results list'
                        continue

                    by_id = {}
                    for item in results:
                        if not isinstance(item, dict):
                            continue
                        case_id = str(item.get('caseId', ''))
                        parsed = item.get('parsed')
                        normalized = item.get('normalized')
                        missing = item.get('missingFields')
                        confidence = item.get('confidence')
                        required_parts = {'houseNumber', 'street', 'ward', 'district', 'province'}
                        parsed_is_valid = (
                            isinstance(parsed, dict)
                            and required_parts.issubset(parsed)
                            and all(parsed[key] is None or isinstance(parsed[key], str) for key in required_parts)
                        )
                        if (case_id in expected_ids and parsed_is_valid
                                and isinstance(normalized, str) and isinstance(missing, list)
                                and isinstance(confidence, (int, float)) and not isinstance(confidence, bool)
                                and 0 <= confidence <= 1
                                and isinstance(item.get('isComplete'), bool)):
                            by_id[case_id] = {
                                'parsed': parsed,
                                'normalized': normalized,
                                'missingFields': [str(value) for value in missing],
                                'confidence': float(confidence),
                                'isComplete': item['isComplete'],
                            }
                    if set(by_id) != expected_ids:
                        last_error = 'Gemini response was incomplete or had invalid fields'
                        continue

                    for case in cases:
                        claim = case.get('studentClaim') or {}
                        case_id = str(case['id'])
                        case['addressAnalysis'] = {
                            **by_id[case_id],
                            'rawAddress': claim.get('declaredAddress') or claim.get('rawAddress') or case.get('description') or '',
                            'source': 'gemini',
                        }
                        case['aiMetadata'] = {
                            'modeUsed': 'live', 'isLive': True, 'isFallback': False,
                            'fallbackOccurred': False, 'isSynthetic': False,
                        }
                    return {'mode': 'GEMINI_LIVE', 'provider': 'Google Gemini', 'model': model,
                            'apiCalls': api_calls, 'fallbackReason': None}
                except Exception as exc:
                    last_error = f'Gemini request failed ({type(exc).__name__})'
                    continue
    except Exception:
        pass

    for case in cases:
        metadata = dict(case.get('aiMetadata') or {})
        metadata.update({
            'modeUsed': 'mock', 'isLive': False, 'isFallback': True,
            'fallbackOccurred': True, 'isSynthetic': True,
        })
        case['aiMetadata'] = metadata
        address_analysis = case.get('addressAnalysis')
        if isinstance(address_analysis, dict):
            address_analysis['source'] = 'mock'
    return {'mode': 'MOCK_FALLBACK', 'provider': 'synthetic fixture', 'model': None,
            'apiCalls': api_calls, 'fallbackReason': f'{FALLBACK_MESSAGE} {last_error}.'}
