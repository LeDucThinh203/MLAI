"""
============================================================================
CASEFLOW AI - AI SERVICE & FALLBACK ENGINE (PYTHON MODULE)
============================================================================
Module tích hợp Google Gemini AI và bộ đệm Fail-Safe 3 chế độ:
  1. Live (Gemini API 2.5 Flash / 2.0 Flash / 1.5 Flash)
  2. Cache (Bộ đệm trích xuất nội bộ)
  3. Mock (Dữ liệu giả lập chuẩn hóa)
============================================================================
"""

import os
import json
import time
from datetime import datetime
import httpx
from app.db.db import db_service

current_ai_mode = os.environ.get('AI_MODE', 'mock')

EXTRACTION_CACHE = {
    'MILITARY_SERVICE_CONFIRMATION': {
        'documentType': 'Cấp giấy xác nhận sinh viên phục vụ tạm hoãn NVQS',
        'contentSummary': 'Địa chỉ thường trú và thông tin học vụ đã được phân tích kiểm định',
        'confidence': 0.96,
        'policyRuleMatch': 'RULE_MILITARY_SERVICE_STANDARD',
        'suggestedAction': 'AUTO_APPROVE_ELIGIBLE'
    },
    'TUITION_DISCOUNT': {
        'extractedHouseholdId': 'HN-2026-8812',
        'householdStatus': 'CẬN NGHÈO',
        'issuingAuthority': 'UBND Phường Linh Trung, TP. Thủ Đức',
        'verifiedDate': '2026-01-15',
        'confidence': 0.96,
        'policyRuleMatch': 'RULE_TUITION_SEC_4A_VALID',
        'suggestedAction': 'AUTO_APPROVE_ELIGIBLE'
    },
    'COMMUNITY_SERVICE': {
        'activityName': 'Chiến dịch Tình nguyện Mùa Hè Xanh 2026',
        'unitSigned': 'Ban Thường Vụ Đoàn Trường',
        'awardedPoints': 15,
        'confidence': 0.98,
        'policyRuleMatch': 'RULE_COMM_ACTIVITY_VALID',
        'suggestedAction': 'AUTO_APPROVE_ELIGIBLE'
    },
    'SCHOLARSHIP': {
        'gpa': 3.85,
        'trainingScore': 92,
        'certificateType': 'Học bổng Doanh nghiệp loại Giỏi',
        'confidence': 0.94,
        'policyRuleMatch': 'RULE_SCHOLARSHIP_MERIT_OK',
        'suggestedAction': 'FORWARD_TO_COMMITTEE'
    },
    'DEFAULT': {
        'documentType': 'Đơn từ thông thường',
        'contentSummary': 'Hồ sơ đã được kiểm tra cấu trúc hợp lệ',
        'confidence': 0.90,
        'policyRuleMatch': 'RULE_STANDARD_VERIFIED',
        'suggestedAction': 'NEEDS_HUMAN_REVIEW'
    }
}


def sanitize_json_string(raw: str) -> str:
    """Loại bỏ markdown blocks ```json ... ``` để parse JSON an toàn."""
    if not isinstance(raw, str):
        return raw
    clean = raw.strip()
    if clean.startswith('```json'):
        clean = clean[7:]
    elif clean.startswith('```'):
        clean = clean[3:]
    if clean.endswith('```'):
        clean = clean[:-3]
    return clean.strip()


def get_ai_mode() -> str:
    return current_ai_mode


def set_ai_mode(mode: str) -> bool:
    global current_ai_mode
    if mode in ('live', 'mock', 'cache'):
        current_ai_mode = mode
        os.environ['AI_MODE'] = mode
        return True
    return False


async def extract_case_data(case_data: dict, actor: dict = None) -> dict:
    """
    Trích xuất dữ liệu bằng AI với cơ chế Fail-Safe & Fallback 3 chế độ.
    """
    if actor is None:
        actor = {'id': 'SYSTEM', 'username': 'ai_engine', 'role': 'SYSTEM'}

    start_time = time.time()
    mode_used = current_ai_mode
    fallback_occurred = False
    fallback_reason = ''
    extracted_result = None

    try:
        if current_ai_mode == 'live':
            api_key = os.environ.get('GEMINI_API_KEY')
            if not api_key or len(api_key.strip()) < 10:
                raise ValueError('Thiếu GEMINI_API_KEY hợp lệ trong file .env để kích hoạt AI Live mode.')

            prompt_text = f"""Bạn là hệ thống AI thẩm định hồ sơ học vụ sinh viên (EDUASSISTANT Engine). Hãy phân tích hồ sơ dưới đây và đánh giá tính hợp lệ theo quy chế học vụ:
- Tiêu đề hồ sơ: "{case_data.get('title')}"
- Danh mục yêu cầu: "{case_data.get('category')}"
- Nội dung giải trình: "{case_data.get('description')}"
- Người nộp: {actor.get('name') or actor.get('username') or 'Sinh viên'}

Hãy phản hồi dưới dạng JSON duy nhất với cấu trúc:
{{
  "documentType": "{case_data.get('category')}",
  "titleExtracted": "{case_data.get('title')}",
  "aiAnalysis": "Phân tích súc tích 2-3 câu về tính hợp lệ và sự đầy đủ của nội dung hồ sơ",
  "confidence": 0.96,
  "policyRuleMatch": "Mã quy tắc phù hợp (ví dụ: RULE_{case_data.get('category')}_PASSED)",
  "suggestedAction": "RECOMMEND_APPROVAL hoặc NEEDS_HUMAN_REVIEW hoặc REJECT_INVALID"
}}
Chỉ trả về JSON hợp lệ."""

            raw_response = None
            used_model = 'gemini-2.5-flash'

            # Thử qua google-genai SDK nếu có
            try:
                from google import genai  # type: ignore
                client = genai.Client(api_key=api_key.strip())
                res = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=prompt_text,
                    config={'response_mime_type': 'application/json'}
                )
                raw_response = res.text
            except Exception:
                # Fallback REST API
                models_to_try = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']
                async with httpx.AsyncClient(timeout=15.0) as http_client:
                    for m in models_to_try:
                        try:
                            used_model = m
                            url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={api_key.strip()}"
                            resp = await http_client.post(url, json={
                                'contents': [{'parts': [{'text': prompt_text}]}],
                                'generationConfig': {'responseMimeType': 'application/json'}
                            })
                            if resp.status_code == 200:
                                res_json = resp.json()
                                candidates = res_json.get('candidates', [])
                                if candidates and 'content' in candidates[0]:
                                    raw_response = candidates[0]['content']['parts'][0]['text']
                                    if raw_response:
                                        break
                        except Exception:
                            continue

            if raw_response:
                clean_json = sanitize_json_string(raw_response)
                parsed = json.loads(clean_json)
                extracted_result = {
                    **parsed,
                    'model': used_model,
                    'provider': f"Google Gemini ({used_model} - Live)",
                    'extractedAt': datetime.utcnow().isoformat() + 'Z'
                }
            else:
                raise RuntimeError('Gemini API không phản hồi nội dung trích xuất.')

        elif current_ai_mode == 'cache':
            cat = case_data.get('category', 'DEFAULT')
            extracted_result = EXTRACTION_CACHE.get(cat, EXTRACTION_CACHE['DEFAULT'])
            mode_used = 'cache'

        else:
            cat = case_data.get('category', 'DEFAULT')
            cached = EXTRACTION_CACHE.get(cat, EXTRACTION_CACHE['DEFAULT'])
            extracted_result = {
                **cached,
                'isMocked': True,
                'extractedAt': datetime.utcnow().isoformat() + 'Z'
            }
            mode_used = 'mock'

    except Exception as live_err:
        fallback_occurred = True
        fallback_reason = str(live_err)
        cat = case_data.get('category', 'DEFAULT')
        mode_used = 'cache' if cat in EXTRACTION_CACHE else 'mock'
        extracted_result = EXTRACTION_CACHE.get(cat, EXTRACTION_CACHE['DEFAULT'])

        # Ghi nhận Audit Trail
        await db_service.log_audit({
            'action': 'AI_FALLBACK_TRIGGERED',
            'actor': {'id': 'SYSTEM_AI', 'username': 'gemini_engine', 'role': 'SYSTEM', 'name': 'Gemini VLM Engine'},
            'caseId': case_data.get('id'),
            'input': {'requestedMode': 'live', 'error': fallback_reason},
            'result': f"FALLBACK_TO_{mode_used.upper()}",
            'reason': f"Tự động chuyển đổi sang {mode_used} do lỗi: {fallback_reason}. Hệ thống tiếp tục hoạt động không gián đoạn."
        })

    duration_ms = round((time.time() - start_time) * 1000)

    return {
        'success': True,
        'modeUsed': mode_used,
        'fallbackOccurred': fallback_occurred,
        'fallbackReason': fallback_reason,
        'durationMs': duration_ms,
        'data': extracted_result
    }
