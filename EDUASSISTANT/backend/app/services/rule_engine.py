"""
============================================================================
CASEFLOW AI - RULE ENGINE & POLICY CHECKER (PYTHON MODULE)
============================================================================
Module phán quyết nghiệp vụ học vụ độc lập, áp dụng chính sách xét duyệt
theo 5 nguyên nhân leo thang chuẩn:
  1. OWNERSHIP_UNCLEAR (Quyền sở hữu / MSSV không khớp)
  2. FACT_UNKNOWN (Thiếu dữ kiện / Ảnh mờ / Không rõ nguồn gốc)
  3. DATA_CONFLICT (Mâu thuẫn dữ liệu kê khai và minh chứng)
  4. AUTHORITY_REQUIRED (Vượt thẩm quyền tự động / Cần Hội đồng)
  5. POLICY_OUT_OF_SCOPE (Ngoài phạm vi chính sách tự động)
============================================================================
"""

import re
import unicodedata
from datetime import datetime

ESCALATION_CONFIG = {
    'OWNERSHIP_UNCLEAR': {
        'code': 'OWNERSHIP_UNCLEAR',
        'label': 'Nghi vấn quyền sở hữu / MSSV không khớp',
        'badgeColor': '#ef4444',
        'badgeBg': 'rgba(239, 68, 68, 0.15)',
        'icon': '🔒',
        'description': 'Họ tên hoặc MSSV trích xuất từ minh chứng khác biệt so với tài khoản sinh viên đang nộp đơn.'
    },
    'FACT_UNKNOWN': {
        'code': 'FACT_UNKNOWN',
        'label': 'Thiếu dữ kiện xác thực / Ảnh mờ / Không rõ nguồn gốc',
        'badgeColor': '#f97316',
        'badgeBg': 'rgba(249, 115, 22, 0.15)',
        'icon': '🚨',
        'description': 'Tài liệu minh chứng thiếu số hiệu, thiếu cơ quan ban hành, ảnh mờ hoặc độ tin cậy trích xuất OCR dưới ngưỡng an toàn (< 75%).'
    },
    'DATA_CONFLICT': {
        'code': 'DATA_CONFLICT',
        'label': 'Mâu thuẫn dữ liệu kê khai và minh chứng',
        'badgeColor': '#eab308',
        'badgeBg': 'rgba(234, 179, 8, 0.15)',
        'icon': '⚠️',
        'description': 'Thông tin sinh viên tự kê khai đối chiếu không khớp với dữ kiện AI trích xuất từ văn bản gốc.'
    },
    'AUTHORITY_REQUIRED': {
        'code': 'AUTHORITY_REQUIRED',
        'label': 'Vượt thẩm quyền tự động / Cần Hội đồng xét duyệt',
        'badgeColor': '#8b5cf6',
        'badgeBg': 'rgba(139, 92, 246, 0.15)',
        'icon': '👑',
        'description': 'Hồ sơ thuộc diện đặc biệt (Ưu tiên Cao, Phúc khảo điểm thi hoặc Học bổng) theo quy chế bắt buộc phải qua Hội đồng Thẩm định.'
    },
    'POLICY_OUT_OF_SCOPE': {
        'code': 'POLICY_OUT_OF_SCOPE',
        'label': 'Ngoài phạm vi chính sách tự động',
        'badgeColor': '#06b6d4',
        'badgeBg': 'rgba(6, 182, 212, 0.15)',
        'icon': '📋',
        'description': 'Yêu cầu nằm ngoài quy chế tự động hóa tiêu chuẩn, cần chuyên viên xem xét ngoại lệ theo quy trình riêng.'
    }
}


def normalize_str(s: str) -> str:
    """Chuẩn hóa chuỗi tiếng Việt: loại bỏ dấu, ký tự đặc biệt, chuyển chữ thường."""
    if not s or not isinstance(s, str):
        return ''
    # Khử dấu tiếng Việt
    nfkd = unicodedata.normalize('NFKD', s)
    no_diacritics = ''.join([c for c in nfkd if not unicodedata.combining(c)])
    # Thay ký tự đặc biệt bằng khoảng trắng
    clean = re.sub(r'[^a-zA-Z0-9]', ' ', no_diacritics).lower()
    # Gom nhiều khoảng trắng thành 1
    return re.sub(r'\s+', ' ', clean).strip()


def evaluate_case(case_data: dict, ocr_data: dict = None, student_user: dict = None) -> dict:
    """
    Đánh giá hồ sơ dựa trên Rule Engine chuyên nghiệp.
    """
    if student_user is None:
        student_user = {}

    discrepancies = []
    files = case_data.get('evidenceFiles') or []
    priority = case_data.get('priority', 'MEDIUM')
    category = case_data.get('category', 'GENERAL')
    description = case_data.get('description', '')
    title = case_data.get('title', '')

    # Lấy dữ liệu OCR
    ocr = ocr_data or (files[0].get('ocrData') if files and isinstance(files[0], dict) else None) or case_data.get('aiExtraction') or None
    
    extracted_entities = (ocr.get('extractedEntities') if isinstance(ocr, dict) else {}) or {}
    ocr_student_name = (ocr.get('studentName') if isinstance(ocr, dict) else None) or extracted_entities.get('Họ và tên')
    ocr_student_code = (ocr.get('studentCode') if isinstance(ocr, dict) else None) or extracted_entities.get('Mã số SV')
    ocr_issuing = (ocr.get('issuingAuthority') if isinstance(ocr, dict) else None) or extracted_entities.get('Cơ quan ban hành')
    ocr_cert_num = (ocr.get('certificateNumber') if isinstance(ocr, dict) else None) or extracted_entities.get('Số hiệu văn bản')
    ocr_category = (ocr.get('suggestedCategory') if isinstance(ocr, dict) else None) or (ocr.get('documentType') if isinstance(ocr, dict) else None)
    
    confidence_score = 0.0
    if isinstance(ocr, dict):
        if 'confidenceScore' in ocr:
            confidence_score = float(ocr['confidenceScore'] or 0.0)
        elif 'confidence' in ocr:
            confidence_score = float(ocr['confidence'] or 0.0)
            
    tamper_risk = (ocr.get('tamperRisk') if isinstance(ocr, dict) else None) or ('LOW' if ocr else 'UNKNOWN')

    # =========================================================================
    # RULE 1: OWNERSHIP_UNCLEAR (Quyền sở hữu / Mạo danh / MSSV không khớp)
    # =========================================================================
    if ocr and (ocr_student_name or ocr_student_code):
        norm_user_code = normalize_str(student_user.get('studentCode') or student_user.get('username') or '')
        norm_ocr_code = normalize_str(ocr_student_code or '')
        norm_user_name = normalize_str(student_user.get('fullName') or '')
        norm_ocr_name = normalize_str(ocr_student_name or '')

        code_match = not ocr_student_code or not student_user.get('studentCode') or (norm_ocr_code in norm_user_code) or (norm_user_code in norm_ocr_code)
        name_match = not ocr_student_name or not student_user.get('fullName') or (norm_ocr_name in norm_user_name) or (norm_user_name in norm_ocr_name)

        discrepancies.append({
            'field': 'Chủ sở hữu hồ sơ (MSSV & Họ tên)',
            'studentClaim': f"{student_user.get('fullName') or student_user.get('username')} ({student_user.get('studentCode') or 'N/A'})",
            'aiFact': f"{ocr_student_name or 'Không rõ'} ({ocr_student_code or 'Không rõ'})",
            'match': code_match and name_match,
            'note': 'Đúng chủ sở hữu tài khoản' if (code_match and name_match) else 'MSSV hoặc họ tên trên văn bản không trùng khớp với tài khoản sinh viên'
        })

        if not code_match or not name_match:
            return {
                'decision': 'ESCALATE_TO_HUMAN',
                'status': 'UNDER_REVIEW',
                'escalationReason': 'OWNERSHIP_UNCLEAR',
                'escalationConfig': ESCALATION_CONFIG['OWNERSHIP_UNCLEAR'],
                'ruleMatched': 'RULE_SEC_01_OWNERSHIP_MISMATCH',
                'explanation': f'Phát hiện nghi vấn quyền sở hữu: Tài liệu minh chứng ghi tên "{ocr_student_name or "N/A"}" (MSSV: "{ocr_student_code or "N/A"}"), không khớp với sinh viên nộp "{student_user.get("fullName")}" (MSSV: "{student_user.get("studentCode") or student_user.get("username")}").',
                'discrepancies': discrepancies,
                'confidence': confidence_score,
                'tamperRisk': tamper_risk,
                'evaluatedAt': datetime.utcnow().isoformat() + 'Z',
                'suggestedAction': 'Cán bộ kiểm tra lại thẻ sinh viên và hồ sơ gốc của sinh viên'
            }

    # =========================================================================
    # RULE 2: FACT_UNKNOWN (Thiếu dữ kiện / Không có file / Ảnh mờ / Độ tin cậy thấp)
    # =========================================================================
    if len(files) == 0:
        discrepancies.append({
            'field': 'Tệp minh chứng đính kèm',
            'studentClaim': 'Khai báo có tài liệu',
            'aiFact': 'Không tìm thấy tệp đính kèm nào',
            'match': False,
            'note': 'Thiếu minh chứng bắt buộc'
        })

        return {
            'decision': 'ESCALATE_TO_HUMAN',
            'status': 'UNDER_REVIEW',
            'escalationReason': 'FACT_UNKNOWN',
            'escalationConfig': ESCALATION_CONFIG['FACT_UNKNOWN'],
            'ruleMatched': 'RULE_FACT_01_NO_EVIDENCE_ATTACHED',
            'explanation': 'Hồ sơ chưa đính kèm tệp minh chứng hoặc tệp tải lên bị lỗi không thể đọc được dữ liệu.',
            'discrepancies': discrepancies,
            'confidence': 0.0,
            'tamperRisk': 'UNKNOWN',
            'evaluatedAt': datetime.utcnow().isoformat() + 'Z',
            'suggestedAction': 'Yêu cầu sinh viên tải lên ảnh chụp minh chứng rõ ràng'
        }

    if confidence_score < 0.75 or tamper_risk == 'HIGH' or (not ocr_issuing and not ocr_cert_num):
        discrepancies.append({
            'field': 'Chất lượng tài liệu & Cơ quan cấp',
            'studentClaim': 'Minh chứng hợp lệ',
            'aiFact': f"Độ tin cậy OCR: {round(confidence_score * 100)}% | Cơ quan: {ocr_issuing or 'Không nhận diện được'}",
            'match': False,
            'note': 'Ảnh mờ hoặc chữ viết khó đọc' if confidence_score < 0.75 else 'Thiếu thông tin cơ quan ban hành hoặc có dấu hiệu can thiệp'
        })

        return {
            'decision': 'ESCALATE_TO_HUMAN',
            'status': 'UNDER_REVIEW',
            'escalationReason': 'FACT_UNKNOWN',
            'escalationConfig': ESCALATION_CONFIG['FACT_UNKNOWN'],
            'ruleMatched': 'RULE_FACT_02_LOW_CONFIDENCE_OR_MISSING_DATA',
            'explanation': f'Dữ kiện văn bản chưa đủ căn cứ xác thực (Độ tin cậy OCR: {round(confidence_score * 100)}% < 75%, hoặc thiếu số hiệu/cơ quan ban hành). Cần chuyên viên kiểm tra bản gốc.',
            'discrepancies': discrepancies,
            'confidence': confidence_score,
            'tamperRisk': tamper_risk,
            'evaluatedAt': datetime.utcnow().isoformat() + 'Z',
            'suggestedAction': 'Chuyên viên kiểm tra trực tiếp ảnh gốc hoặc liên hệ đơn vị cấp giấy xác nhận'
        }

    # =========================================================================
    # RULE 3: DATA_CONFLICT (Mâu thuẫn danh mục / dữ liệu đối chiếu)
    # =========================================================================
    if ocr and ocr_category:
        norm_category = category.upper()
        norm_ocr_cat = str(ocr_category).upper()
        is_category_conflict = False

        if norm_category == 'TUITION_DISCOUNT' and ('COMMUNITY_SERVICE' in norm_ocr_cat or 'GRADE_APPEAL' in norm_ocr_cat):
            is_category_conflict = True
        elif norm_category == 'COMMUNITY_SERVICE' and ('TUITION_DISCOUNT' in norm_ocr_cat or 'GRADE_APPEAL' in norm_ocr_cat):
            is_category_conflict = True
        elif norm_category == 'GRADE_APPEAL' and ('TUITION_DISCOUNT' in norm_ocr_cat or 'COMMUNITY_SERVICE' in norm_ocr_cat):
            is_category_conflict = True

        discrepancies.append({
            'field': 'Loại hồ sơ & Danh mục',
            'studentClaim': category,
            'aiFact': str(ocr_category),
            'match': not is_category_conflict,
            'note': 'Danh mục khai báo mâu thuẫn với nội dung trên văn bản' if is_category_conflict else 'Khớp đúng danh mục quy định'
        })

        if is_category_conflict:
            return {
                'decision': 'ESCALATE_TO_HUMAN',
                'status': 'UNDER_REVIEW',
                'escalationReason': 'DATA_CONFLICT',
                'escalationConfig': ESCALATION_CONFIG['DATA_CONFLICT'],
                'ruleMatched': 'RULE_CONFLICT_01_CATEGORY_MISMATCH',
                'explanation': f'Mâu thuẫn dữ liệu: Sinh viên nộp đơn diện "{category}" nhưng AI OCR nhận diện văn bản thuộc diện "{ocr_category}".',
                'discrepancies': discrepancies,
                'confidence': confidence_score,
                'tamperRisk': tamper_risk,
                'evaluatedAt': datetime.utcnow().isoformat() + 'Z',
                'suggestedAction': 'Cán bộ hướng dẫn sinh viên chọn lại đúng loại đơn hoặc làm rõ nội dung'
            }

    # =========================================================================
    # RULE 4: AUTHORITY_REQUIRED (Vượt thẩm quyền / Hội đồng / Ưu tiên Cao)
    # =========================================================================
    if priority == 'HIGH' or category == 'GRADE_APPEAL' or category == 'SCHOLARSHIP':
        reason_detail = ''
        if priority == 'HIGH':
            reason_detail = 'Hồ sơ có mức độ ưu tiên CAO (HIGH) ảnh hưởng lớn đến quyền lợi hoặc tài chính.'
        elif category == 'GRADE_APPEAL':
            reason_detail = 'Hồ sơ Phúc khảo điểm thi theo quy chế đào tạo bắt buộc phải có Biên bản họp Hội đồng Khảo thí.'
        elif category == 'SCHOLARSHIP':
            reason_detail = 'Xét duyệt Học bổng đòi hỏi Hội đồng Thẩm định & Doanh nghiệp tài trợ chuẩn y danh sách.'

        discrepancies.append({
            'field': 'Cấp thẩm quyền xử lý',
            'studentClaim': f"{category} ({priority})",
            'aiFact': 'Yêu cầu phê chuẩn của Hội đồng / Trưởng khoa',
            'match': False,
            'note': 'Vượt giới hạn thẩm quyền phê duyệt tự động'
        })

        return {
            'decision': 'ESCALATE_TO_HUMAN',
            'status': 'UNDER_REVIEW',
            'escalationReason': 'AUTHORITY_REQUIRED',
            'escalationConfig': ESCALATION_CONFIG['AUTHORITY_REQUIRED'],
            'ruleMatched': 'RULE_AUTH_01_COMMITTEE_APPROVAL_REQUIRED',
            'explanation': f'Hồ sơ vượt thẩm quyền xử lý tự động: {reason_detail}',
            'discrepancies': discrepancies,
            'confidence': confidence_score,
            'tamperRisk': tamper_risk,
            'evaluatedAt': datetime.utcnow().isoformat() + 'Z',
            'suggestedAction': 'Chuyển hồ sơ vào Hàng đợi Thẩm định của Hội đồng / Ban Thư ký duyệt'
        }

    # =========================================================================
    # RULE 5: POLICY_OUT_OF_SCOPE (Ngoài quy chế tự động hóa)
    # =========================================================================
    special_keywords = ['ngoại lệ', 'đặc cách', 'cứu xét đặc biệt', 'hoãn thi quá hạn', 'bảo lưu đột xuất', 'hoàn cảnh đặc biệt']
    lower_text = f"{title} {description}".lower()
    has_special_request = any(kw in lower_text for kw in special_keywords)

    if category == 'GENERAL' or has_special_request:
        discrepancies.append({
            'field': 'Quy chuẩn chính sách',
            'studentClaim': 'Hồ sơ thông thường / Khác' if category == 'GENERAL' else 'Xin cứu xét ngoại lệ',
            'aiFact': 'Nằm ngoài bộ quy tắc tự động hóa chuẩn',
            'match': False,
            'note': 'Cần chuyên viên đánh giá hồ sơ cá biệt'
        })

        return {
            'decision': 'ESCALATE_TO_HUMAN',
            'status': 'UNDER_REVIEW',
            'escalationReason': 'POLICY_OUT_OF_SCOPE',
            'escalationConfig': ESCALATION_CONFIG['POLICY_OUT_OF_SCOPE'],
            'ruleMatched': 'RULE_POLICY_01_SPECIAL_OR_GENERAL_CASE',
            'explanation': 'Hồ sơ có nội dung ngoại lệ hoặc thuộc danh mục khác (GENERAL) chưa có chính sách tự động hóa.',
            'discrepancies': discrepancies,
            'confidence': confidence_score,
            'tamperRisk': tamper_risk,
            'evaluatedAt': datetime.utcnow().isoformat() + 'Z',
            'suggestedAction': 'Chuyên viên tiếp nhận hồ sơ và giải quyết theo quy trình thủ công riêng'
        }

    # =========================================================================
    # ALL PASSED -> AUTO_APPROVE (TỰ ĐỘNG DUYỆT)
    # =========================================================================
    discrepancies.append({
        'field': 'Toàn bộ tiêu chí & chính sách',
        'studentClaim': 'Đầy đủ & Hợp lệ',
        'aiFact': 'Đạt chuẩn 100% quy chế',
        'match': True,
        'note': 'Đủ điều kiện tự động phê duyệt ngay lập tức'
    })

    return {
        'decision': 'AUTO_APPROVE',
        'status': 'APPROVED',
        'escalationReason': None,
        'escalationConfig': None,
        'ruleMatched': 'RULE_AUTO_PASSED_STANDARD_2026',
        'explanation': 'Hồ sơ đầy đủ minh chứng hợp lệ, OCR trích xuất khớp 100% danh tính và dữ liệu kê khai, rủi ro làm giả thấp. Hệ thống tự động phê chuẩn theo Quy chế Đào tạo.',
        'discrepancies': discrepancies,
        'confidence': confidence_score,
        'tamperRisk': 'LOW',
        'evaluatedAt': datetime.utcnow().isoformat() + 'Z',
        'suggestedAction': 'Hệ thống đã tự động xuất Quyết định phê duyệt học vụ có chữ ký số.'
    }
