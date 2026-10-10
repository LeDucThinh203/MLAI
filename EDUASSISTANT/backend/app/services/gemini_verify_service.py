from __future__ import annotations

import json
import os
from typing import Any

from app.services.gemini_generate_service import generate_json as generate_gemini_json
from app.services.openrouter_service import generate_json as generate_openrouter_json


async def add_gemini_review(result: dict[str, Any]) -> dict[str, Any]:
    """Add a secondary review; this never changes deterministic PASS/FAIL."""
    api_key = os.environ.get('GEMINI_API_KEY', '').strip()
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
    expected_ids = {str(item.get('caseId')) for item in payload}
    prompt = (
        'Bạn là người rà soát phụ cho bộ kiểm tra phần mềm EDUASSISTANT. '
        'Dữ liệu sau là tình huống tổng hợp, không phải hồ sơ người thật. '
        'Đánh giá tính nhất quán giữa quyết định thực tế của bộ quy tắc, quyết định kỳ vọng '
        'và lý do. Không đưa ra kết luận pháp lý, không tự thay đổi kết quả PASS/FAIL. '
        'Trả về JSON duy nhất dạng {"results":[{"caseId":"...",'
        '"assessment":"CONSISTENT hoặc REVIEW","rationale":"một câu ngắn bằng tiếng Việt"}]}. '
        'Phải có đủ mỗi caseId đúng một lần.\nDữ liệu:\n' + json.dumps(payload, ensure_ascii=False)
    )

    def valid_review(payload_data: dict) -> bool:
        reviews = payload_data.get('results')
        if not isinstance(reviews, list):
            return False
        normalized = {
            str(review.get('caseId')): review for review in reviews
            if isinstance(review, dict) and review.get('assessment') in ('CONSISTENT', 'REVIEW')
            and isinstance(review.get('rationale'), str)
        }
        return set(normalized) == expected_ids

    if len(api_key) >= 10:
        gemini_data, gemini_model, _, _ = await generate_gemini_json(
            prompt, api_key, max_tokens=3000, validator=valid_review,
        )
        if gemini_data is not None and gemini_model:
            provider = 'Google Gemini'
            data = gemini_data
            model = gemini_model
            mode = 'GEMINI_LIVE'
        else:
            data = None
    else:
        data = None

    if data is None:
        data, _, model, _ = await generate_openrouter_json(
            prompt, max_tokens=3000, validator=valid_review,
        )
        provider = 'OpenRouter'
        mode = 'OPENROUTER_LIVE'

    if data is not None:
        by_id = {str(item['caseId']): item for item in data['results']}
        for item in result.get('results', []):
            review = by_id.get(str(item.get('caseId')))
            if review:
                item['geminiReview'] = {
                    'assessment': review['assessment'], 'rationale': review['rationale'][:500],
                }
        result['aiReview'] = {
            'mode': mode,
            'provider': provider,
            'model': model,
            'message': f'{provider} đã rà soát tình huống tổng hợp. Kết quả PASS/FAIL vẫn do bộ quy tắc xác định.',
        }
        return result

    result['aiReview'] = {
        'mode': 'DETERMINISTIC_FALLBACK',
        'provider': None,
        'message': 'Không model Gemini hay OpenRouter nào trả được kết quả hợp lệ; vẫn giữ kết quả từ bộ quy tắc.',
    }
    return result
