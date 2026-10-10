from __future__ import annotations

import json
import os
from typing import Any

import httpx


async def add_gemini_review(result: dict[str, Any]) -> dict[str, Any]:
    """Add a secondary Gemini review to synthetic harness output.

    The deterministic rule engine remains the source of PASS/FAIL. Gemini only
    comments on the synthetic outcomes; its response never changes a verdict.
    """
    api_key = os.environ.get('GEMINI_API_KEY', '').strip()
    if len(api_key) < 10:
        result['aiReview'] = {
            'mode': 'DETERMINISTIC_FALLBACK',
            'provider': None,
            'message': 'Gemini chưa được cấu hình; đang hiển thị kết quả kiểm tra sẵn có.'
        }
        return result

    payload = [
        {
            'caseId': item.get('caseId'),
            'caseName': item.get('caseName'),
            'expectedDecision': item.get('expectedDecision'),
            'actualDecision': item.get('actualDecision'),
            'expectedReason': item.get('expectedReason'),
            'actualReason': item.get('actualReason'),
            'ruleMatched': item.get('ruleMatched'),
            'ruleExplanation': item.get('explanation'),
            'rulePassed': item.get('pass'),
        }
        for item in result.get('results', [])
    ]
    prompt = (
        'Bạn là người rà soát phụ cho bộ kiểm tra phần mềm EDUASSISTANT. '
        'Dữ liệu sau là tình huống tổng hợp, không phải hồ sơ người thật. '
        'Đánh giá tính nhất quán giữa quyết định thực tế của bộ quy tắc, quyết định kỳ vọng '
        'và lý do. Không đưa ra kết luận pháp lý, không tự thay đổi kết quả PASS/FAIL. '
        'Trả về JSON duy nhất dạng {"results":[{"caseId":"...",'
        '"assessment":"CONSISTENT hoặc REVIEW","rationale":"một câu ngắn bằng tiếng Việt"}]}. '
        'Phải có đủ mỗi caseId đúng một lần.\nDữ liệu:\n' + json.dumps(payload, ensure_ascii=False)
    )

    models = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite']
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=5.0)) as client:
            for model in models:
                response = await client.post(
                    f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
                    params={'key': api_key},
                    json={
                        'contents': [{'parts': [{'text': prompt}]}],
                        'generationConfig': {
                            'responseMimeType': 'application/json',
                            'temperature': 0.1,
                            'maxOutputTokens': 3000,
                        },
                    },
                )
                if response.status_code != 200:
                    continue
                candidates = response.json().get('candidates', [])
                parts = candidates[0].get('content', {}).get('parts', []) if candidates else []
                text = ''.join(part.get('text', '') for part in parts).strip()
                parsed = json.loads(text)
                reviews = parsed.get('results')
                expected_ids = {str(item.get('caseId')) for item in payload}
                if not isinstance(reviews, list):
                    continue
                normalized = {}
                for review in reviews:
                    if not isinstance(review, dict):
                        continue
                    case_id = str(review.get('caseId', ''))
                    assessment = review.get('assessment')
                    rationale = review.get('rationale')
                    if case_id in expected_ids and assessment in ('CONSISTENT', 'REVIEW') and isinstance(rationale, str):
                        normalized[case_id] = {
                            'assessment': assessment,
                            'rationale': rationale[:500],
                        }
                if set(normalized) != expected_ids:
                    continue
                for item in result.get('results', []):
                    item['geminiReview'] = normalized.get(str(item.get('caseId')))
                result['aiReview'] = {
                    'mode': 'GEMINI_LIVE',
                    'provider': 'Google Gemini',
                    'model': model,
                    'message': 'Gemini đã rà soát tình huống tổng hợp. Kết quả PASS/FAIL vẫn do bộ quy tắc xác định.'
                }
                return result
    except Exception:
        pass

    result['aiReview'] = {
        'mode': 'DETERMINISTIC_FALLBACK',
        'provider': None,
        'message': 'Không gọi được Gemini hoặc phản hồi không hợp lệ; đang hiển thị kết quả kiểm tra sẵn có.'
    }
    return result
