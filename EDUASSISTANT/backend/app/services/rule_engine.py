"""
============================================================================
EDUASSISTANT - RULE ENGINE & ESCALATION REFEREE (PYTHON MODULE)
============================================================================
Chuyên sâu: CẤP GIẤY XÁC NHẬN SINH VIÊN PHỤC VỤ TẠM HOÃN NGHĨA VỤ QUÂN SỰ
(MILITARY_SERVICE_CONFIRMATION)

Áp dụng chính sách xét duyệt theo 5 nguyên nhân leo thang chuẩn của Escalation Referee:
  1. OWNERSHIP_UNCLEAR: Sai lệch định danh, MSSV/Họ tên không khớp tài khoản.
  2. FACT_UNKNOWN: Thiếu số nhà/đường/phường/tỉnh, thiếu hồ sơ thường trú trường,
                   độ tin cậy < ngưỡng, non-live fail-safe.
  3. DATA_CONFLICT: Chọn địa chỉ tạm trú, hoặc mâu thuẫn trọng yếu với thường trú lưu trữ.
  4. AUTHORITY_REQUIRED: Trạng thái sinh viên không an toàn (đình chỉ, bảo lưu, thôi học,
                         chưa kích hoạt học kỳ, chưa có TKB, thiếu dữ liệu học vụ).
  5. POLICY_OUT_OF_SCOPE: Yêu cầu đặc cách, ngoài quy trình tự động chuẩn.

ĐẶC BIỆT:
  - Lỗi thuần túy về format (IN HOA, chữ thường, viết tắt P./Q./TP.) KHÔNG được tự động leo thang.
  - Fail-safe: Chế độ mock, cache, fallback hoặc synthetic categorically DENY AUTO_APPROVE.
  - TUYỆT ĐỐI KHÔNG INVENT dữ liệu trường (nếu thiếu -> ESCALATE_TO_HUMAN).
  - Hoàn toàn thread-safe: Nhận ai_context / provenance rõ ràng, không phụ thuộc global state.
============================================================================
"""

import re
import unicodedata
from datetime import datetime
from typing import Dict, Any, List, Optional
from app.services.escalation_policy_service import get_confidence_threshold
from app.services.address_ai_service import (
    deterministic_parse_address,
    are_addresses_materially_conflicting,
    clean_administrative_token,
    normalize_capitalization_vietnamese
)

ESCALATION_CONFIG = {
    'OWNERSHIP_UNCLEAR': {
        'code': 'OWNERSHIP_UNCLEAR',
        'label': 'Nghi vấn quyền sở hữu / MSSV không khớp',
        'badgeColor': '#ef4444',
        'badgeBg': 'rgba(239, 68, 68, 0.15)',
        'icon': '🔒',
        'description': 'MSSV hoặc họ tên trên yêu cầu không khớp với hồ sơ gốc của tài khoản sinh viên đang đăng nhập.'
    },
    'FACT_UNKNOWN': {
        'code': 'FACT_UNKNOWN',
        'label': 'Thiếu dữ kiện xác thực / Địa chỉ chưa đủ thành phần',
        'badgeColor': '#f97316',
        'badgeBg': 'rgba(249, 115, 22, 0.15)',
        'icon': '🚨',
        'description': 'Địa chỉ thường trú thiếu số nhà/đường/phường/tỉnh, thiếu địa chỉ gốc tại trường, độ tin cậy bóc tách dưới ngưỡng, hoặc AI chạy ở chế độ giả lập/dự phòng.'
    },
    'DATA_CONFLICT': {
        'code': 'DATA_CONFLICT',
        'label': 'Mâu thuẫn dữ liệu kê khai và hồ sơ lưu trữ',
        'badgeColor': '#eab308',
        'badgeBg': 'rgba(234, 179, 8, 0.15)',
        'icon': '⚠️',
        'description': 'Sinh viên kê khai địa chỉ tạm trú (quy định bắt buộc thường trú) hoặc địa chỉ thường trú mâu thuẫn trọng yếu với dữ liệu nhà trường đã lưu.'
    },
    'AUTHORITY_REQUIRED': {
        'code': 'AUTHORITY_REQUIRED',
        'label': 'Vượt thẩm quyền tự động / Cần cán bộ xác minh',
        'badgeColor': '#8b5cf6',
        'badgeBg': 'rgba(139, 92, 246, 0.15)',
        'icon': '👑',
        'description': 'Sinh viên có tình trạng học tập bất thường (Tạm đình chỉ, bảo lưu, cảnh báo học vụ, chưa có thời khóa biểu, thiếu dữ liệu học kỳ) cần cán bộ Phòng Đào tạo xác minh.'
    },
    'POLICY_OUT_OF_SCOPE': {
        'code': 'POLICY_OUT_OF_SCOPE',
        'label': 'Ngoài phạm vi chính sách tự động',
        'badgeColor': '#06b6d4',
        'badgeBg': 'rgba(6, 182, 212, 0.15)',
        'icon': '📋',
        'description': 'Yêu cầu có nội dung đặc cách, cứu xét ngoại lệ ngoài quy trình cấp Giấy xác nhận tạm hoãn NVQS chuẩn.'
    }
}


def normalize_str(s: str) -> str:
    """Chuẩn hóa chuỗi tiếng Việt: loại bỏ dấu, ký tự đặc biệt, chuyển chữ thường."""
    if not s or not isinstance(s, str):
        return ''
    nfkd = unicodedata.normalize('NFKD', s)
    no_diacritics = ''.join(c for c in nfkd if not unicodedata.combining(c))
    clean = re.sub(r'[^a-zA-Z0-9]', ' ', no_diacritics).lower()
    return re.sub(r'\s+', ' ', clean).strip()


def evaluate_case(
    case_data: dict,
    ocr_data: Optional[dict] = None,
    student_user: Optional[dict] = None,
    ai_context: Optional[dict] = None
) -> dict:
    """
    Đánh giá hồ sơ Cấp giấy xác nhận sinh viên phục vụ tạm hoãn NVQS
    dựa trên Escalation Referee 5 nguyên nhân.
    Thread-safe, nhận context trực tiếp và không giả mạo dữ liệu trường.
    """
    if student_user is None:
        student_user = {}

    discrepancies: List[Dict[str, Any]] = []
    current_threshold = get_confidence_threshold()

    # =========================================================================
    # LỚP 1: AUTHORITATIVE INSTITUTIONAL FACTS (Dữ liệu gốc nhà trường)
    # TUYỆT ĐỐI KHÔNG SỬ DỤNG FALLBACK GIẢ (ACTIVE, 2023-09-01, địa chỉ mẫu...)
    # =========================================================================
    inst_facts = case_data.get('authoritativeInstitutionalFacts') or case_data.get('institutionalFacts') or {}
    student_id = inst_facts.get('studentId') or student_user.get('id')
    # A login name is not an authoritative student code unless the identity
    # system has explicitly stored it in studentCode.
    auth_student_code = inst_facts.get('studentCode') or student_user.get('studentCode')
    auth_full_name = inst_facts.get('fullName') or student_user.get('fullName')

    raw_academic_status = inst_facts.get('academicStatus') if inst_facts.get('academicStatus') is not None else student_user.get('academicStatus')
    academic_status = str(raw_academic_status).upper() if raw_academic_status is not None else 'UNKNOWN'

    course_start = inst_facts.get('courseStartDate') or student_user.get('courseStartDate')
    course_end = inst_facts.get('courseEndDate') or student_user.get('courseEndDate')

    current_term_active = inst_facts.get('currentTermActive') if 'currentTermActive' in inst_facts else student_user.get('currentTermActive')
    if isinstance(current_term_active, str):
        current_term_active = current_term_active.lower() in ('true', '1')
    elif current_term_active is not None:
        current_term_active = bool(current_term_active)

    has_schedule = inst_facts.get('hasCurrentSchedule') if 'hasCurrentSchedule' in inst_facts else student_user.get('hasCurrentSchedule')
    if isinstance(has_schedule, str):
        has_schedule = has_schedule.lower() in ('true', '1')
    elif has_schedule is not None:
        has_schedule = bool(has_schedule)

    reg_permanent_address = (
        inst_facts.get('registeredPermanentAddress')
        or student_user.get('registeredPermanentAddress')
    )

    # =========================================================================
    # LỚP 2: STUDENT CLAIMS (Dữ liệu sinh viên kê khai)
    # =========================================================================
    student_claim = case_data.get('studentClaim') or {}
    declared_address_type = str(
        student_claim.get('addressType') or case_data.get('addressType') or 'PERMANENT'
    ).upper()
    raw_address = (
        student_claim.get('declaredAddress')
        or student_claim.get('rawAddress')
        or case_data.get('declaredAddress')
        or case_data.get('rawAddress')
        or case_data.get('description')
        or ''
    )
    request_reason = student_claim.get('requestReason') or case_data.get('requestReason') or ''
    notes = student_claim.get('notes') or case_data.get('notes') or case_data.get('description') or ''
    req_student_code = case_data.get('studentCode') or student_claim.get('studentCode') or auth_student_code
    req_full_name = case_data.get('studentName') or student_claim.get('fullName') or auth_full_name

    # =========================================================================
    # LỚP 3: AI-DERIVED FACTS (Dữ liệu bóc tách từ địa chỉ)
    # =========================================================================
    ai_address = (
        case_data.get('addressAnalysis')
        or case_data.get('aiAddressAnalysis')
        or case_data.get('aiExtraction')
        or {}
    )
    parsed_sub = ai_address.get('parsed') if isinstance(ai_address.get('parsed'), dict) else {}
    has_valid_normalized = bool(ai_address.get('normalizedAddress') or ai_address.get('normalized'))

    if not ai_address or not has_valid_normalized:
        # Fallback deterministic parse nếu chưa có AI facts sẵn
        ai_address = deterministic_parse_address(raw_address)
        parsed_sub = {}

    parsed_house = ai_address.get('houseNumber') or parsed_sub.get('houseNumber')
    parsed_street = ai_address.get('street') or parsed_sub.get('street')
    parsed_ward = ai_address.get('wardCommune') or parsed_sub.get('ward')
    parsed_district = ai_address.get('district') or parsed_sub.get('district')
    parsed_province = ai_address.get('provinceCity') or parsed_sub.get('province')
    normalized_addr = ai_address.get('normalizedAddress') or ai_address.get('normalized') or raw_address
    missing_fields = list(ai_address.get('missingFields') or [])
    ambiguous_fields = list(ai_address.get('ambiguousFields') or [])
    confidence_score = float(ai_address.get('confidence') or 0.90)

    # -------------------------------------------------------------------------
    # AI Provenance Resolution (Thread-Safe Context)
    # Thứ tự ưu tiên: ai_context -> case_data['aiMetadata'] -> ai_address['provenance'] -> ocr_data
    # -------------------------------------------------------------------------
    ctx = ai_context if isinstance(ai_context, dict) else {}
    ai_meta = case_data.get('aiMetadata') or ai_address.get('provenance') or (ocr_data if isinstance(ocr_data, dict) else {}) or {}

    # Provenance must be supplied by the extraction result/context. Absent
    # evidence fails closed; global process state cannot prove a live AI call.
    mode_used = str(ctx.get('modeUsed') or ai_meta.get('modeUsed') or (ocr_data and isinstance(ocr_data, dict) and ocr_data.get('modeUsed')) or '')
    is_live = bool(ctx.get('isLive') if 'isLive' in ctx else (ai_meta.get('isLive', False) or (ocr_data and isinstance(ocr_data, dict) and ocr_data.get('isLive', False))))
    if mode_used != 'live':
        is_live = False
    is_fallback = bool(ctx.get('isFallback') if 'isFallback' in ctx else (ai_meta.get('isFallback', False) or ai_meta.get('fallbackOccurred', False) or (ocr_data and isinstance(ocr_data, dict) and ocr_data.get('isFallback', False))))
    is_synthetic = bool(ctx.get('isSynthetic') if 'isSynthetic' in ctx else (ai_meta.get('isSynthetic', False) or (ocr_data and isinstance(ocr_data, dict) and ocr_data.get('isSynthetic', False)) or (mode_used == 'mock')))

    # =========================================================================
    # RULE 1: OWNERSHIP_UNCLEAR (Quyền sở hữu / MSSV & Họ tên không khớp)
    # =========================================================================
    norm_auth_code = normalize_str(auth_student_code or '')
    norm_req_code = normalize_str(req_student_code or '')
    norm_auth_name = normalize_str(auth_full_name or '')
    norm_req_name = normalize_str(req_full_name or '')

    # Student codes are authoritative identifiers. Missing values and substring
    # matches must never establish ownership.
    code_match = bool(norm_req_code and norm_auth_code and norm_req_code == norm_auth_code)
    # Names may differ only in harmless formatting. They are never matched by
    # substring: "Nguyen Van A" must not match "Nguyen Van Anh".
    name_match = bool(norm_req_name and norm_auth_name and norm_req_name == norm_auth_name)

    # Kiểm tra thêm nếu có OCR tài liệu tùy thân đính kèm
    if ocr_data and isinstance(ocr_data, dict):
        ocr_code = ocr_data.get('studentCode')
        ocr_name = ocr_data.get('studentName')
        if ocr_code and normalize_str(ocr_code) != norm_auth_code:
            code_match = False
        if ocr_name and normalize_str(ocr_name) != norm_auth_name:
            name_match = False

    discrepancies.append({
        'field': 'Định danh chủ sở hữu (MSSV & Họ tên)',
        'studentClaim': f"{req_full_name} ({req_student_code})",
        'institutionalFact': f"{auth_full_name} ({auth_student_code})",
        'match': code_match and name_match,
        'note': 'Đúng định danh sinh viên sở hữu tài khoản' if (code_match and name_match) else 'MSSV hoặc họ tên trên yêu cầu không khớp với hồ sơ gốc của sinh viên'
    })

    if not code_match or not name_match:
        return {
            'decision': 'ESCALATE_TO_HUMAN',
            'status': 'UNDER_REVIEW',
            'escalationReason': 'OWNERSHIP_UNCLEAR',
            'escalationConfig': ESCALATION_CONFIG['OWNERSHIP_UNCLEAR'],
            'ruleMatched': 'RULE_SEC_01_OWNERSHIP_MISMATCH',
            'explanation': f'Phát hiện nghi vấn quyền sở hữu: Yêu cầu mang thông tin "{req_full_name}" (MSSV: "{req_student_code}"), không khớp với tài khoản gốc "{auth_full_name}" (MSSV: "{auth_student_code}").',
            'discrepancies': discrepancies,
            'confidence': confidence_score,
            'thresholdUsed': current_threshold,
            'evaluatedAt': datetime.utcnow().isoformat() + 'Z',
            'suggestedAction': 'Cán bộ kiểm tra lại CCCD và hồ sơ gốc của sinh viên trước khi xử lý'
        }

    # =========================================================================
    # RULE 2: POLICY_OUT_OF_SCOPE (Yêu cầu đặc cách / Ngoài quy trình chuẩn)
    # Loại bỏ keyword "vượt" đơn lẻ gây false-positive
    # =========================================================================
    special_keywords = [
        'đặc cách', 'ngoại lệ', 'cứu xét', 'hoàn cảnh đặc biệt', 'xin gấp',
        'miễn nghĩa vụ', 'hoãn nhập ngũ theo luật riêng', 'vượt khóa', 'vượt quy định',
        'vượt thẩm quyền', 'vượt thời hạn'
    ]
    lower_notes = f"{request_reason} {notes}".lower()
    has_special_request = any(kw in lower_notes for kw in special_keywords)

    discrepancies.append({
        'field': 'Quy chế quy trình xử lý',
        'studentClaim': 'Cấp giấy xác nhận sinh viên tiêu chuẩn' if not has_special_request else 'Có yêu cầu cứu xét đặc cách',
        'institutionalFact': 'Quy chế cấp Giấy xác nhận tạm hoãn NVQS tiêu chuẩn',
        'match': not has_special_request,
        'note': 'Thuộc quy chuẩn tự động' if not has_special_request else 'Yêu cầu nằm ngoài quy chế tự động tiêu chuẩn'
    })

    if has_special_request:
        return {
            'decision': 'ESCALATE_TO_HUMAN',
            'status': 'UNDER_REVIEW',
            'escalationReason': 'POLICY_OUT_OF_SCOPE',
            'escalationConfig': ESCALATION_CONFIG['POLICY_OUT_OF_SCOPE'],
            'ruleMatched': 'RULE_POLICY_01_SPECIAL_EXCEPTION_REQUEST',
            'explanation': 'Hồ sơ có nội dung xin đặc cách hoặc đề nghị ngoài quy trình cấp Giấy xác nhận tạm hoãn NVQS tiêu chuẩn.',
            'discrepancies': discrepancies,
            'confidence': confidence_score,
            'thresholdUsed': current_threshold,
            'normalizedAddress': normalized_addr,
            'evaluatedAt': datetime.utcnow().isoformat() + 'Z',
            'suggestedAction': 'Chuyên viên tiếp nhận hồ sơ và giải quyết theo thủ tục cứu xét cá biệt'
        }

    # =========================================================================
    # RULE 3: AUTHORITY_REQUIRED (Vượt thẩm quyền / Tình trạng học tập cần xác minh)
    # Kiểm tra cả trường hợp thiếu dữ liệu học vụ từ nhà trường
    # =========================================================================
    needs_officer_review = False
    auth_reason = ""

    def parse_course_date(value):
        if not isinstance(value, str):
            return None
        try:
            return datetime.strptime(value.strip(), '%Y-%m-%d').date()
        except (TypeError, ValueError):
            return None

    start_date = parse_course_date(course_start)
    end_date = parse_course_date(course_end)
    today = datetime.utcnow().date()
    if not course_start or not course_end:
        needs_officer_review = True
        auth_reason = 'Thiếu mốc bắt đầu hoặc kết thúc khóa học trong hồ sơ đào tạo của trường'
    elif not start_date or not end_date or start_date > end_date:
        needs_officer_review = True
        auth_reason = 'Mốc thời gian khóa học không hợp lệ, cần cán bộ xác minh'
    elif today < start_date or today > end_date:
        needs_officer_review = True
        auth_reason = 'Dữ liệu đào tạo nằm ngoài khoảng khóa học được nhà trường ghi nhận, cần cán bộ xác minh'
    elif academic_status in ('SUSPENDED', 'WITHDRAWN', 'GRADUATED', 'UNKNOWN'):
        needs_officer_review = True
        status_label = {
            'SUSPENDED': 'Đang bị tạm đình chỉ học tập / bảo lưu',
            'WITHDRAWN': 'Đã thôi học / xóa tên',
            'GRADUATED': 'Đã tốt nghiệp',
            'UNKNOWN': 'Không xác định được trạng thái học vụ (Thiếu dữ liệu gốc nhà trường)'
        }.get(academic_status, academic_status)
        auth_reason = f"Trạng thái sinh viên cần xác minh ({status_label})"

    elif current_term_active is None or current_term_active is False:
        needs_officer_review = True
        auth_reason = "Sinh viên chưa kích hoạt học phần hoặc chưa hoàn thành thủ tục học kỳ hiện tại (hoặc thiếu dữ liệu học kỳ)"

    elif has_schedule is None or has_schedule is False:
        needs_officer_review = True
        auth_reason = "Chưa có dữ liệu thời khóa biểu / đăng ký môn học trong học kỳ này"

    discrepancies.append({
        'field': 'Tình trạng đào tạo & học vụ',
        'studentClaim': 'Đang học tập bình thường',
        'institutionalFact': f"Trạng thái: {academic_status} | Khóa học: {course_start} → {course_end} | HK hiện tại: {current_term_active} | Thời khóa biểu: {has_schedule}",
        'match': not needs_officer_review,
        'note': 'Đủ điều kiện đào tạo tiêu chuẩn' if not needs_officer_review else auth_reason
    })

    if needs_officer_review:
        return {
            'decision': 'ESCALATE_TO_HUMAN',
            'status': 'UNDER_REVIEW',
            'escalationReason': 'AUTHORITY_REQUIRED',
            'escalationConfig': ESCALATION_CONFIG['AUTHORITY_REQUIRED'],
            'ruleMatched': 'RULE_AUTH_01_ACADEMIC_STATUS_NEEDS_OFFICER',
            'explanation': f"Cần chuyên viên Phòng Đào tạo xác minh: {auth_reason}.",
            'discrepancies': discrepancies,
            'confidence': confidence_score,
            'thresholdUsed': current_threshold,
            'normalizedAddress': normalized_addr,
            'evaluatedAt': datetime.utcnow().isoformat() + 'Z',
            'suggestedAction': 'Chuyển chuyên viên Phòng Quản lý Đào tạo kiểm tra tiến độ học tập và điều kiện cấp giấy'
        }

    # =========================================================================
    # RULE 4: DATA_CONFLICT (Loại địa chỉ Tạm trú)
    # =========================================================================
    if declared_address_type == 'TEMPORARY':
        discrepancies.append({
            'field': 'Loại địa chỉ cư trú',
            'studentClaim': 'TẠM TRÚ (TEMPORARY)',
            'institutionalFact': 'Quy định tạm hoãn NVQS bắt buộc khai báo địa chỉ THƯỜNG TRÚ',
            'match': False,
            'note': 'Sinh viên nhập nhầm địa chỉ tạm trú thay vì thường trú'
        })
        return {
            'decision': 'ESCALATE_TO_HUMAN',
            'status': 'UNDER_REVIEW',
            'escalationReason': 'DATA_CONFLICT',
            'escalationConfig': ESCALATION_CONFIG['DATA_CONFLICT'],
            'ruleMatched': 'RULE_CONFLICT_01_TEMPORARY_ADDRESS_NOT_ALLOWED',
            'explanation': 'Mâu thuẫn loại địa chỉ: Sinh viên chọn loại địa chỉ "Tạm trú", trong khi thủ tục cấp Giấy xác nhận tạm hoãn NVQS bắt buộc phải dùng địa chỉ "Thường trú".',
            'discrepancies': discrepancies,
            'confidence': confidence_score,
            'thresholdUsed': current_threshold,
            'normalizedAddress': normalized_addr,
            'evaluatedAt': datetime.utcnow().isoformat() + 'Z',
            'suggestedAction': 'Hướng dẫn sinh viên đổi sang khai báo địa chỉ thường trú để gửi cơ quan quân sự'
        }

    # =========================================================================
    # RULE 5: FACT_UNKNOWN (Thiếu thành phần địa chỉ cốt lõi / Độ tin cậy thấp)
    # Bắt buộc tối thiểu: Số nhà, Đường/thôn/ấp, Phường/Xã, Tỉnh/Thành phố
    # Chữ HOA / chữ thường / viết tắt chuẩn KHÔNG coi là FACT_UNKNOWN nếu đủ dữ kiện.
    # =========================================================================
    has_missing_essential = False
    missing_desc = []

    has_house = bool(parsed_house and 'houseNumber' not in missing_fields)
    has_street = bool(parsed_street and 'street' not in missing_fields)
    has_ward = bool(parsed_ward and 'ward' not in missing_fields and 'wardCommune' not in missing_fields)
    has_province = bool(parsed_province and 'province' not in missing_fields and 'provinceCity' not in missing_fields)

    if not has_house:
        has_missing_essential = True
        missing_desc.append('Số nhà')
    if not has_street:
        has_missing_essential = True
        missing_desc.append('Đường/Thôn/Ấp')
    if not has_ward:
        has_missing_essential = True
        missing_desc.append('Phường/Xã')
    if not has_province:
        has_missing_essential = True
        missing_desc.append('Tỉnh/Thành phố')

    if not raw_address or len(raw_address.strip()) < 5:
        has_missing_essential = True
        missing_desc.append('Địa chỉ thường trú quá ngắn hoặc để trống')

    discrepancies.append({
        'field': 'Tính đầy đủ của địa chỉ thường trú',
        'studentClaim': raw_address,
        'aiFact': f"Normalized: {normalized_addr} | Missing: {', '.join(missing_desc) if missing_desc else 'Đầy đủ'}",
        'match': not has_missing_essential and confidence_score >= current_threshold,
        'note': 'Địa chỉ đầy đủ các cấp đơn vị hành chính' if not has_missing_essential else f"Thiếu thông tin: {', '.join(missing_desc)}"
    })

    if has_missing_essential or confidence_score < current_threshold:
        reason_msg = (
            f"Địa chỉ thường trú sinh viên khai báo thiếu dữ kiện bắt buộc ({', '.join(missing_desc)})."
            if has_missing_essential
            else f"Độ tin cậy bóc tách địa chỉ ({round(confidence_score * 100)}%) thấp hơn ngưỡng quy định ({round(current_threshold * 100)}%)."
        )
        return {
            'decision': 'ESCALATE_TO_HUMAN',
            'status': 'UNDER_REVIEW',
            'escalationReason': 'FACT_UNKNOWN',
            'escalationConfig': ESCALATION_CONFIG['FACT_UNKNOWN'],
            'ruleMatched': 'RULE_FACT_01_INCOMPLETE_ADDRESS',
            'explanation': f"Cần cán bộ kiểm tra: {reason_msg}",
            'discrepancies': discrepancies,
            'confidence': confidence_score,
            'thresholdUsed': current_threshold,
            'missingFields': missing_desc,
            'normalizedAddress': normalized_addr,
            'evaluatedAt': datetime.utcnow().isoformat() + 'Z',
            'suggestedAction': 'Yêu cầu sinh viên bổ sung rõ số nhà, tên đường, phường/xã và tỉnh/thành phố'
        }

    # =========================================================================
    # RULE 6: DATA_CONFLICT & FACT_UNKNOWN (Địa chỉ thường trú gốc)
    # Nếu thiếu địa chỉ thường trú trong hồ sơ trường -> FACT_UNKNOWN
    # Nếu có mâu thuẫn trọng yếu -> DATA_CONFLICT
    # =========================================================================
    if not reg_permanent_address or not str(reg_permanent_address).strip():
        discrepancies.append({
            'field': 'Đối chiếu địa chỉ thường trú với hồ sơ trường',
            'studentClaim': raw_address,
            'institutionalFact': 'CHƯA CÓ TRONG HỒ SƠ NHÀ TRƯỜNG (None)',
            'match': False,
            'note': 'Hồ sơ gốc của nhà trường thiếu dữ liệu địa chỉ thường trú đã xác thực'
        })
        return {
            'decision': 'ESCALATE_TO_HUMAN',
            'status': 'UNDER_REVIEW',
            'escalationReason': 'FACT_UNKNOWN',
            'escalationConfig': ESCALATION_CONFIG['FACT_UNKNOWN'],
            'ruleMatched': 'RULE_FACT_02_MISSING_INSTITUTIONAL_PERMANENT_ADDRESS',
            'explanation': 'Thiếu dữ kiện xác thực: Hồ sơ gốc của nhà trường chưa lưu địa chỉ thường trú chính thức của sinh viên để đối chiếu.',
            'discrepancies': discrepancies,
            'confidence': confidence_score,
            'thresholdUsed': current_threshold,
            'normalizedAddress': normalized_addr,
            'evaluatedAt': datetime.utcnow().isoformat() + 'Z',
            'suggestedAction': 'Yêu cầu sinh viên xuất trình CCCD gắn chip / sổ hộ khẩu để cập nhật địa chỉ thường trú vào hệ thống nhà trường'
        }

    is_conflict, conflict_exp = are_addresses_materially_conflicting(raw_address, reg_permanent_address)
    discrepancies.append({
        'field': 'Đối chiếu địa chỉ thường trú với hồ sơ trường',
        'studentClaim': raw_address,
        'institutionalFact': reg_permanent_address,
        'match': not is_conflict,
        'note': 'Khớp hoặc tương thích với hồ sơ trường' if not is_conflict else conflict_exp
    })

    if is_conflict:
        return {
            'decision': 'ESCALATE_TO_HUMAN',
            'status': 'UNDER_REVIEW',
            'escalationReason': 'DATA_CONFLICT',
            'escalationConfig': ESCALATION_CONFIG['DATA_CONFLICT'],
            'ruleMatched': 'RULE_CONFLICT_02_PERMANENT_ADDRESS_MISMATCH',
            'explanation': f"Mâu thuẫn dữ liệu thường trú: {conflict_exp}. Sinh viên khai '{raw_address}', khác với hồ sơ nhà trường đang lưu '{reg_permanent_address}'.",
            'discrepancies': discrepancies,
            'confidence': confidence_score,
            'thresholdUsed': current_threshold,
            'normalizedAddress': normalized_addr,
            'evaluatedAt': datetime.utcnow().isoformat() + 'Z',
            'suggestedAction': 'Cán bộ liên hệ sinh viên kiểm tra sổ hộ khẩu / CCCD gắn chip để cập nhật hồ sơ'
        }

    # =========================================================================
    # FAIL-SAFE: MOCK / CACHE / FALLBACK / SYNTHETIC KHÔNG ĐƯỢC AUTO_APPROVE
    # =========================================================================
    is_safe_live = (
        is_live is True
        and not is_fallback
        and not is_synthetic
        and mode_used == 'live'
    )

    if not is_safe_live:
        reason_detail = "mock" if (is_synthetic or mode_used == "mock") else ("cache" if mode_used == "cache" else "fallback/non-live")
        discrepancies.append({
            'field': 'Xác thực nguồn gốc AI (Provenance Fail-Safe)',
            'studentClaim': 'Hồ sơ đạt chuẩn',
            'institutionalFact': f"AI Mode: {mode_used} | Live: {is_live} | Fallback: {is_fallback} | Synthetic: {is_synthetic}",
            'match': False,
            'note': f'Dữ liệu AI là {reason_detail} nên hệ thống không được phép tự động phê duyệt'
        })
        return {
            'decision': 'ESCALATE_TO_HUMAN',
            'status': 'UNDER_REVIEW',
            'escalationReason': 'FACT_UNKNOWN',
            'escalationConfig': ESCALATION_CONFIG['FACT_UNKNOWN'],
            'ruleMatched': 'RULE_FAILSAFE_NON_LIVE_AI',
            'explanation': f'Dữ liệu AI hiện tại là {reason_detail} nên hệ thống không được phép tự động phê duyệt.',
            'discrepancies': discrepancies,
            'confidence': confidence_score,
            'thresholdUsed': current_threshold,
            'normalizedAddress': normalized_addr,
            'provenance': {
                'modeUsed': mode_used,
                'isLive': is_live,
                'isFallback': is_fallback,
                'isSynthetic': is_synthetic,
                'confidence': confidence_score
            },
            'evaluatedAt': datetime.utcnow().isoformat() + 'Z',
            'suggestedAction': 'Chuyển cán bộ thẩm định thủ công do hệ thống đang chạy ở chế độ giả lập hoặc dự phòng (mock/cache/fallback).'
        }

    # =========================================================================
    # TẤT CẢ TIÊU CHÍ THỎA MÃN & SAFE LIVE -> AUTO_APPROVE
    # =========================================================================
    discrepancies.append({
        'field': 'Toàn bộ tiêu chí cấp Giấy xác nhận NVQS',
        'studentClaim': 'Đầy đủ & Hợp lệ',
        'institutionalFact': 'Khớp 100% hồ sơ đào tạo và địa chỉ thường trú',
        'match': True,
        'note': 'Các dữ kiện bắt buộc của workflow nội bộ hiện không phát hiện mâu thuẫn trọng yếu.'
    })

    return {
        'decision': 'AUTO_APPROVE',
        'status': 'APPROVED',
        'escalationReason': None,
        'escalationConfig': None,
        'ruleMatched': 'RULE_AUTO_PASSED_MILITARY_SERVICE_2026',
        'explanation': 'Hồ sơ đáp ứng các điều kiện tự động xử lý của workflow nội bộ hiện được cấu hình. Hệ thống tạo Giấy xác nhận sinh viên; quyết định tạm hoãn NVQS thuộc cơ quan có thẩm quyền.',
        'discrepancies': discrepancies,
        'confidence': confidence_score,
        'thresholdUsed': current_threshold,
        'normalizedAddress': normalized_addr,
        'provenance': {
            'modeUsed': mode_used,
            'isLive': is_live,
            'isFallback': False,
            'isSynthetic': False,
            'confidence': confidence_score
        },
        'evaluatedAt': datetime.utcnow().isoformat() + 'Z',
        'suggestedAction': 'Hệ thống đã tự động xử lý theo workflow nội bộ và tạo mã xác thực toàn vẹn HMAC-SHA256.'
    }
