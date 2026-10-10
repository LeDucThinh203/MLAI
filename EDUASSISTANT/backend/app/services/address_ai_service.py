"""
============================================================================
EDUASSISTANT - ADDRESS AI SERVICE & NORMALIZATION ENGINE (PYTHON MODULE)
============================================================================
Service chuyên trách chuẩn hóa và phân tích cấu trúc địa chỉ thường trú
phục vụ quy trình "Cấp Giấy xác nhận sinh viên phục vụ tạm hoãn nghĩa vụ quân sự".
Tuân thủ nguyên tắc:
  - Gemini VLM/LLM chỉ dùng để bóc tách thành phần và chuẩn hóa chữ viết.
  - Gemini KHÔNG quyết định chính sách hoặc tuyên bố pháp lý về NVQS.
  - Fail-safe 3 chế độ (live, mock, cache). Fallback deterministic khi không live.
  - Chuẩn hóa chữ HOA / chữ thường, các từ viết tắt hành chính phổ biến.
============================================================================
"""

import os
import re
import json
import math
import time
import unicodedata
from typing import Dict, Any, List, Tuple, Optional
import httpx

from app.services.ai_service import get_ai_mode, sanitize_json_string
from app.services.openrouter_service import generate_json


def remove_vietnamese_tones(text: str) -> str:
    """Loại bỏ dấu tiếng Việt để phục vụ so sánh không dấu."""
    if not text:
        return ""
    nfkd = unicodedata.normalize('NFKD', text)
    no_diacritics = ''.join(c for c in nfkd if not unicodedata.combining(c))
    return no_diacritics.replace('đ', 'd').replace('Đ', 'D')


def normalize_capitalization_vietnamese(text: str) -> str:
    """
    Chuẩn hóa viết hoa chữ cái đầu cho từng từ trong cụm địa chỉ tiếng Việt.
    Giữ nguyên các thành phần số/xuyệt (ví dụ: 12/4, 20A, Q1).
    """
    if not text:
        return ""
    words = text.strip().split()
    capitalized = []
    for w in words:
        if '/' in w or (re.search(r'\d', w) and not re.search(r'^[a-zA-ZÀ-ỹ]', w)):
            capitalized.append(w.upper())
        elif len(w) > 0:
            capitalized.append(w[0].upper() + w[1:].lower())
    return ' '.join(capitalized)


def preprocess_address_shorthand(raw: str) -> str:
    """
    Tiền xử lý các từ viết tắt hành chính phổ biến trước khi phân tách:
    P, P., Phường | Q, Q., Quận | TPHCM, HCM, HN | TX., TT.
    """
    if not raw:
        return ""
    s = " " + re.sub(r'\s+', ' ', raw.strip()) + " "

    # Tỉnh / Thành phố trước tiên
    s = re.sub(r'(?i)\b(tphcm|tp\.hcm|tp\s*hcm|hcmc|hcm)\b', ', TP. Hồ Chí Minh', s)
    s = re.sub(r'(?i)\b(tp\.?\s*hồ\s*chí\s*minh)\b', ', TP. Hồ Chí Minh', s)
    s = re.sub(r'(?i)\b(hà\s*nội|ha\s*noi|hn)\b', ', Hà Nội', s)
    s = re.sub(r'(?i)\b(đà\s*nẵng|da\s*nang)\b', ', TP. Đà Nẵng', s)
    s = re.sub(r'(?i)\b(cần\s*thơ|can\s*tho)\b', ', TP. Cần Thơ', s)
    s = re.sub(r'(?i)\b(hải\s*phòng|hai\s*phong)\b', ', TP. Hải Phòng', s)

    # Quận / Huyện
    s = re.sub(r'(?i)\b(quận|q\.)\s*([0-9a-zA-ZÀ-ỹ\s]+?)(?=,|$)', r', Quận \2', s)
    s = re.sub(r'(?i)\bq\s*([0-9]+)\b', r', Quận \1', s)
    s = re.sub(r'(?i)\b(huyện|h\.)\s*([0-9a-zA-ZÀ-ỹ\s]+?)(?=,|$)', r', Huyện \2', s)
    s = re.sub(r'(?i)\b(thị\s*xã|tx\.)\s*([0-9a-zA-ZÀ-ỹ\s]+?)(?=,|$)', r', Thị xã \2', s)

    # Phường / Xã / Thị trấn
    s = re.sub(r'(?i)\b(phường|p\.)\s*([0-9a-zA-ZÀ-ỹ\s]+?)(?=,|$)', r', Phường \2', s)
    s = re.sub(r'(?i)\bp\s+([0-9a-zA-ZÀ-ỹ\s]+?)(?=,\s*Quận|,\s*Huyện|,\s*TP|$)', r', Phường \1', s)
    s = re.sub(r'(?i)\b(xã|x\.)\s*([0-9a-zA-ZÀ-ỹ\s]+?)(?=,|$)', r', Xã \2', s)
    s = re.sub(r'(?i)\b(thị\s*trấn|tt\.)\s*([0-9a-zA-ZÀ-ỹ\s]+?)(?=,|$)', r', Thị trấn \2', s)

    # Dọn dẹp dấu phẩy thừa và khoảng trắng
    s = re.sub(r',\s*,+', ',', s)
    s = re.sub(r'\s+', ' ', s).strip(' ,')
    return s


def deterministic_parse_address(raw_address: str) -> Dict[str, Any]:
    """
    Bộ phân tích địa chỉ xác định (Deterministic Rule-Based Fallback)
    phân rã địa chỉ tiếng Việt thành các thành phần hành chính khi không có AI Live.
    """
    if not raw_address or not raw_address.strip():
        return {
            'houseNumber': None,
            'street': None,
            'wardCommune': None,
            'district': None,
            'provinceCity': None,
            'normalizedAddress': '',
            'missingFields': ['houseNumber', 'street', 'wardCommune', 'district', 'provinceCity'],
            'ambiguousFields': ['rawAddress'],
            'confidence': 0.0
        }

    raw = raw_address.strip()
    preprocessed = preprocess_address_shorthand(raw)
    parts = [p.strip() for p in preprocessed.split(',') if p.strip()]

    house_number = None
    street = None
    ward = None
    district = None
    province = None
    missing: List[str] = []
    ambiguous: List[str] = []

    # Quét từng phần tử sau khi đã phân tách dấu phẩy
    unmatched_parts: List[str] = []
    for p in parts:
        lower_p = p.lower()
        no_tone_p = remove_vietnamese_tones(lower_p)

        if any(prov in no_tone_p for prov in ['ho chi minh', 'tphcm', 'ha noi', 'da nang', 'can tho', 'hai phong', 'dong nai', 'binh duong', 'long an', 'tinh', 'thanh pho']):
            if not province:
                if 'ho chi minh' in no_tone_p or 'tphcm' in no_tone_p:
                    province = "TP. Hồ Chí Minh"
                elif 'ha noi' in no_tone_p:
                    province = "Hà Nội"
                elif 'da nang' in no_tone_p:
                    province = "TP. Đà Nẵng"
                else:
                    province = normalize_capitalization_vietnamese(p)
                continue

        if re.search(r'^(quận|q\b|huyện|h\b|thị xã|tx\b|tp\.\s*[a-z])', lower_p):
            if not district:
                district = normalize_capitalization_vietnamese(p)
                continue

        if re.search(r'^(phường|p\b|xã|x\b|thị trấn|tt\b)', lower_p):
            if not ward:
                ward = normalize_capitalization_vietnamese(p)
                continue

        unmatched_parts.append(p)

    # Phân tích số nhà và tên đường từ các phần tử còn lại (thường là phần tử đầu)
    if unmatched_parts:
        first_segment = unmatched_parts[0]
        # Match số nhà (ví dụ 12/4, 88, 120A, 15-17)
        hn_match = re.match(r'^([0-9]+[a-zA-Z0-9/\-]*)\s+(.+)$', first_segment)
        if hn_match:
            house_number = hn_match.group(1).strip()
            street = normalize_capitalization_vietnamese(hn_match.group(2).strip())
        elif re.match(r'^[0-9]+[a-zA-Z0-9/\-]*$', first_segment):
            house_number = first_segment
            if len(unmatched_parts) > 1:
                street = normalize_capitalization_vietnamese(unmatched_parts[1])
        else:
            street = normalize_capitalization_vietnamese(first_segment)

    # Kiểm tra thiếu các trường hành chính
    if not house_number:
        missing.append('houseNumber')
    if not street:
        missing.append('street')
    if not ward:
        missing.append('wardCommune')
    if not province:
        missing.append('provinceCity')

    # Xây dựng normalizedAddress
    tokens: List[str] = []
    if house_number and street:
        tokens.append(f"{house_number} {street}")
    elif street:
        tokens.append(street)
    elif house_number:
        tokens.append(house_number)

    if ward:
        tokens.append(ward if ward.startswith(('Phường', 'Xã', 'Thị trấn')) else f"Phường {ward}")
    if district:
        tokens.append(district if district.startswith(('Quận', 'Huyện', 'Thị xã', 'TP.')) else f"Quận {district}")
    if province:
        tokens.append(province)

    normalized_address = ', '.join(tokens) if tokens else normalize_capitalization_vietnamese(raw)

    confidence = 0.95
    if missing:
        confidence -= 0.15 * len(missing)
    confidence = max(0.40, min(0.96, confidence))

    return {
        'houseNumber': house_number,
        'street': street,
        'wardCommune': ward,
        'district': district,
        'provinceCity': province,
        'normalizedAddress': normalized_address,
        'missingFields': missing,
        'ambiguousFields': ambiguous,
        'confidence': round(confidence, 2)
    }


async def normalize_student_address(
    raw_address: str,
    address_type: str = "PERMANENT",
    actor: dict = None
) -> Dict[str, Any]:
    """
    Chuẩn hóa địa chỉ học vụ sinh viên với cơ chế Gemini Live & Fail-Safe:
      - Live mode: Gọi Gemini trích xuất structured entities + chuẩn hóa chữ hoa/thường.
      - Mock / Cache / Error: Fallback deterministic parse, ghi nhận rõ provenance.
    """
    if actor is None:
        actor = {'username': 'student', 'role': 'STUDENT'}

    start_time = time.time()
    mode = get_ai_mode()
    api_key = os.environ.get('GEMINI_API_KEY', '').strip()
    is_live = False
    is_fallback = False
    used_model = 'deterministic-regex'

    if not raw_address or not raw_address.strip():
        fallback_res = deterministic_parse_address(raw_address)
        fallback_res.update({
            'modeUsed': mode,
            'isLive': False,
            'isFallback': True,
            'isSynthetic': (mode == 'mock'),
            'durationMs': round((time.time() - start_time) * 1000, 2)
        })
        return fallback_res

    # Nếu AI_MODE == 'live' và có API key hợp lệ
    if mode == 'live' and len(api_key) <= 10:
        prompt = (
            'Chuan hoa cu phap dia chi Viet Nam, chi trich xuat du lieu co trong dau vao; '
            'khong tu dien thanh phan con thieu va khong dua ra ket luan phap ly. '
            'Tra ve JSON voi houseNumber, street, wardCommune, district, provinceCity, '
            'normalizedAddress, missingFields, ambiguousFields, confidence. Dia chi: ' + raw_address
        )
        parsed, _ = await generate_json(prompt, max_tokens=1000)
        if isinstance(parsed, dict):
            confidence = parsed.get('confidence', 0)
            required = ('houseNumber', 'street', 'wardCommune', 'district', 'provinceCity', 'normalizedAddress')
            if (all(key in parsed for key in required)
                    and all(parsed[key] is None or isinstance(parsed[key], str) for key in required[:-1])
                    and isinstance(parsed['normalizedAddress'], str)
                    and isinstance(parsed.get('missingFields'), list)
                    and isinstance(parsed.get('ambiguousFields'), list)
                    and isinstance(confidence, (int, float)) and not isinstance(confidence, bool)
                    and math.isfinite(confidence) and 0 <= confidence <= 1):
                return {
                    **{key: parsed[key] for key in required},
                    'missingFields': parsed['missingFields'], 'ambiguousFields': parsed['ambiguousFields'],
                    'confidence': float(confidence), 'modeUsed': 'live', 'isLive': True,
                    'isFallback': False, 'isSynthetic': False, 'provider': 'OpenRouter',
                    'modelUsed': os.environ.get('OPENROUTER_MODEL', 'openrouter/free'),
                    'durationMs': round((time.time() - start_time) * 1000, 2),
                }

    if mode == 'live' and len(api_key) > 10:
        prompt_text = f"""Bạn là bộ chuẩn hóa địa chỉ hành chính Việt Nam (EDUASSISTANT Address Normalizer).
Nhiệm vụ: Phân tích địa chỉ sinh viên tự khai dưới đây để phục vụ hồ sơ cấp Giấy xác nhận tạm hoãn NVQS:
"{raw_address}"

Quy tắc bắt buộc:
1. Trích xuất:
   - houseNumber: Số nhà (VD: "12/4", "20A") hoặc null nếu thiếu
   - street: Tên đường/thôn/ấp/khu phố (viết hoa chữ cái đầu chuẩn tiếng Việt) hoặc null nếu thiếu
   - wardCommune: Tên Phường/Xã/Thị trấn (VD: "Đa Kao", "Phường 12") hoặc null nếu thiếu
   - district: Tên Quận/Huyện/Thị xã/Thành phố thuộc tỉnh (VD: "Quận 1", "TP. Thủ Đức") hoặc null nếu không rõ
   - provinceCity: Tên Tỉnh/Thành phố trực thuộc TW (VD: "TP. Hồ Chí Minh", "Hà Nội") hoặc null nếu thiếu
2. normalizedAddress: Chuỗi địa chỉ ghép chuẩn mực theo thứ tự: Số nhà Đường, Phường/Xã, Quận/Huyện, Tỉnh/Thành phố. Viết hoa chuẩn tiếng Việt, có dấu phẩy ngăn cách.
3. missingFields: Danh sách các trường bị thiếu trong tập ["houseNumber", "street", "wardCommune", "district", "provinceCity"].
4. ambiguousFields: Danh sách các trường mơ hồ, viết tắt không thể đoán chắc.
5. confidence: Điểm số tin cậy từ 0.00 đến 1.00.
6. LƯU Ý AN TOÀN: Tuyệt đối không phán xét quyền hoãn NVQS hay tính pháp lý. Chỉ chuẩn hóa cú pháp địa chỉ.

Trả về DUY NHẤT một JSON hợp lệ:
{{
  "houseNumber": "...",
  "street": "...",
  "wardCommune": "...",
  "district": "...",
  "provinceCity": "...",
  "normalizedAddress": "...",
  "missingFields": [],
  "ambiguousFields": [],
  "confidence": 0.96
}}"""

        try:
            raw_json_str = None
            try:
                from google import genai  # type: ignore
                client = genai.Client(api_key=api_key)
                res = client.models.generate_content(
                    model='gemini-3.8-flash',
                    contents=prompt_text,
                    config={'response_mime_type': 'application/json'}
                )
                raw_json_str = res.text
                used_model = 'gemini-3.8-flash'
            except Exception:
                models_to_try = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite']
                async with httpx.AsyncClient(timeout=12.0) as http_client:
                    for m in models_to_try:
                        try:
                            used_model = m
                            url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={api_key}"
                            resp = await http_client.post(url, json={
                                'contents': [{'parts': [{'text': prompt_text}]}],
                                'generationConfig': {'responseMimeType': 'application/json'}
                            })
                            if resp.status_code == 200:
                                res_json = resp.json()
                                candidates = res_json.get('candidates', [])
                                if candidates and 'content' in candidates[0]:
                                    raw_json_str = candidates[0]['content']['parts'][0]['text']
                                    if raw_json_str:
                                        break
                        except Exception:
                            continue

            if raw_json_str:
                parsed = json.loads(sanitize_json_string(raw_json_str))
                confidence_raw = parsed.get('confidence')
                confidence = float(confidence_raw) if confidence_raw is not None else 0.0
                if not math.isfinite(confidence) or not 0.0 <= confidence <= 1.0:
                    raise ValueError('AI confidence is outside the valid range.')
                return {
                    'houseNumber': parsed.get('houseNumber'),
                    'street': parsed.get('street'),
                    'wardCommune': parsed.get('wardCommune'),
                    'district': parsed.get('district'),
                    'provinceCity': parsed.get('provinceCity'),
                    'normalizedAddress': parsed.get('normalizedAddress') or raw_address,
                    'missingFields': parsed.get('missingFields') or [],
                    'ambiguousFields': parsed.get('ambiguousFields') or [],
                    'confidence': confidence,
                    'modeUsed': 'live',
                    'isLive': True,
                    'isFallback': False,
                    'isSynthetic': False,
                    'modelUsed': used_model,
                    'durationMs': round((time.time() - start_time) * 1000, 2)
                }
        except Exception:
            is_fallback = True

        # Gemini is primary. Try OpenRouter's free-model router before the
        # deterministic parser; this only extracts address text and never decides policy.
        if is_fallback or not raw_json_str:
            openrouter_prompt = (
                'Chuẩn hóa cú pháp địa chỉ Việt Nam, chỉ trích xuất dữ liệu có trong đầu vào; '
                'không tự điền thành phần còn thiếu và không đưa ra kết luận pháp lý. '
                'Trả về JSON với houseNumber, street, wardCommune, district, provinceCity, '
                'normalizedAddress, missingFields, ambiguousFields, confidence. Địa chỉ: ' + raw_address
            )
            parsed, _ = await generate_json(openrouter_prompt, max_tokens=1000)
            if isinstance(parsed, dict):
                confidence = parsed.get('confidence', 0)
                required = ('houseNumber', 'street', 'wardCommune', 'district', 'provinceCity', 'normalizedAddress')
                if (all(key in parsed for key in required)
                        and all(parsed[key] is None or isinstance(parsed[key], str) for key in required[:-1])
                        and isinstance(parsed['normalizedAddress'], str)
                        and isinstance(parsed.get('missingFields'), list)
                        and isinstance(parsed.get('ambiguousFields'), list)
                        and isinstance(confidence, (int, float)) and not isinstance(confidence, bool)
                        and math.isfinite(confidence) and 0 <= confidence <= 1):
                    return {
                        **{key: parsed[key] for key in required},
                        'missingFields': parsed['missingFields'],
                        'ambiguousFields': parsed['ambiguousFields'],
                        'confidence': float(confidence),
                        'modeUsed': 'live', 'isLive': True, 'isFallback': False,
                        'isSynthetic': False, 'provider': 'OpenRouter',
                        'modelUsed': os.environ.get('OPENROUTER_MODEL', 'openrouter/free'),
                        'durationMs': round((time.time() - start_time) * 1000, 2),
                    }

    # Fallback deterministic
    det_res = deterministic_parse_address(raw_address)
    det_res.update({
        'modeUsed': mode,
        'isLive': is_live,
        'isFallback': (mode == 'live' or is_fallback),
        'isSynthetic': (mode == 'mock'),
        'modelUsed': used_model,
        'durationMs': round((time.time() - start_time) * 1000, 2)
    })
    return det_res


def clean_administrative_token(text: str) -> str:
    """Chuẩn hóa một đoạn văn bản: xóa dấu, loại bỏ tiền tố hành chính, chuyển chữ thường."""
    if not text:
        return ""
    t = remove_vietnamese_tones(text).lower()
    t = re.sub(r'\b(phuong|xa|thi tran|quan|huyen|thi xa|thanh pho|tp|tphcm|tinh|p|q|x|h|t)\b', ' ', t)
    t = re.sub(r'[^a-z0-9]', ' ', t)
    return re.sub(r'\s+', ' ', t).strip()


def are_addresses_materially_conflicting(addr1: str, addr2: str) -> Tuple[bool, str]:
    """
    So sánh hai địa chỉ thường trú để phát hiện mâu thuẫn trọng yếu (material conflict).
    Quy tắc:
      - Bỏ qua khác biệt viết HOA / chữ thường.
      - Bỏ qua khác biệt khoảng trắng và dấu phẩy thừa.
      - Bỏ qua các cách viết tắt hành chính: P./Phường, Q./Quận, TP./Thành phố, T./Tỉnh.
      - Trả về (is_conflict: bool, explanation: str).
    """
    if not addr1 or not addr2:
        return True, "Một trong hai địa chỉ để trống"

    c1 = clean_administrative_token(addr1)
    c2 = clean_administrative_token(addr2)

    # Nếu chuỗi sau khi làm sạch hoàn toàn giống nhau -> Không mâu thuẫn
    if c1 == c2:
        return False, "Địa chỉ trùng khớp (đã bỏ qua hoa/thường và tiền tố hành chính)"

    # Phân tích từng thành phần qua deterministic parser để so sánh cụ thể
    p1 = deterministic_parse_address(addr1)
    p2 = deterministic_parse_address(addr2)

    # So sánh Tỉnh/Thành
    prov1 = clean_administrative_token(p1.get('provinceCity') or '')
    prov2 = clean_administrative_token(p2.get('provinceCity') or '')
    if prov1 and prov2 and prov1 != prov2:
        return True, f"Mâu thuẫn Tỉnh/Thành phố: '{p1.get('provinceCity')}' khác với '{p2.get('provinceCity')}'"

    # So sánh Quận/Huyện
    dist1 = clean_administrative_token(p1.get('district') or '')
    dist2 = clean_administrative_token(p2.get('district') or '')
    if dist1 and dist2 and dist1 != dist2:
        return True, f"Mâu thuẫn Quận/Huyện: '{p1.get('district')}' khác với '{p2.get('district')}'"

    # So sánh Phường/Xã
    ward1 = clean_administrative_token(p1.get('wardCommune') or '')
    ward2 = clean_administrative_token(p2.get('wardCommune') or '')
    if ward1 and ward2 and ward1 != ward2:
        return True, f"Mâu thuẫn Phường/Xã: '{p1.get('wardCommune')}' khác với '{p2.get('wardCommune')}'"

    # So sánh Tên đường và Số nhà
    st1 = clean_administrative_token(p1.get('street') or '')
    st2 = clean_administrative_token(p2.get('street') or '')
    hn1 = (p1.get('houseNumber') or '').strip().lower()
    hn2 = (p2.get('houseNumber') or '').strip().lower()

    if hn1 and hn2 and hn1 != hn2:
        return True, f"Mâu thuẫn số nhà: '{p1.get('houseNumber')}' khác với '{p2.get('houseNumber')}'"

    if st1 and st2 and (st1 not in st2 and st2 not in st1):
        return True, f"Mâu thuẫn tên đường: '{p1.get('street')}' khác với '{p2.get('street')}'"

    # Không có mâu thuẫn trọng yếu
    return False, "Địa chỉ tương thích, không phát hiện mâu thuẫn trọng yếu"
