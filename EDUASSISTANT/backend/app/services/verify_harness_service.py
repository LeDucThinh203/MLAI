"""
============================================================================
EDUASSISTANT - DETERMINISTIC VERIFY HARNESS SERVICE
============================================================================
Bộ thẩm định kiểm chuẩn tự động một chạm (One-click Verify Harness)
dành cho Giám khảo và Hội đồng đánh giá Hackathon MLAI 2026.
Chuyên đề: Cấp giấy xác nhận sinh viên phục vụ tạm hoãn nghĩa vụ quân sự
(MILITARY_SERVICE_CONFIRMATION).

Chạy in-memory hoàn toàn độc lập, không thay đổi dữ liệu thật trong CSDL:
  1. Routine Valid Case         -> Expected: AUTO_APPROVE
  2. Format-only Difference     -> Expected: AUTO_APPROVE
  3. FACT_UNKNOWN (Missing Ward)-> Expected: ESCALATE_TO_HUMAN (FACT_UNKNOWN)
  4. DATA_CONFLICT (Temporary)  -> Expected: ESCALATE_TO_HUMAN (DATA_CONFLICT)
  5. DATA_CONFLICT (Mismatch)   -> Expected: ESCALATE_TO_HUMAN (DATA_CONFLICT)
  6. AUTHORITY_REQUIRED (Status)-> Expected: ESCALATE_TO_HUMAN (AUTHORITY_REQUIRED)
  7. POLICY_OUT_OF_SCOPE        -> Expected: ESCALATE_TO_HUMAN (POLICY_OUT_OF_SCOPE)
  8. OWNERSHIP_UNCLEAR          -> Expected: ESCALATE_TO_HUMAN (OWNERSHIP_UNCLEAR)
  9. Non-live Failsafe          -> Expected: ESCALATE_TO_HUMAN (FACT_UNKNOWN)
============================================================================
"""

import time
import secrets
from datetime import datetime
from typing import Dict, Any, List
from app.services.rule_engine import evaluate_case


HARNESS_CASES = [
    {
        'id': 'HARNESS-01-ROUTINE-PASS',
        'title': 'Cấp giấy hoãn NVQS hợp lệ chuẩn (Thường trú khớp 100%)',
        'description': 'Đơn xin cấp giấy xác nhận hoãn NVQS nộp đúng hạn, thường trú khớp hồ sơ gốc.',
        'category': 'MILITARY_SERVICE_CONFIRMATION',
        'priority': 'MEDIUM',
        'student': {
            'fullName': 'Nguyễn Văn An',
            'studentCode': 'SV2026-1001',
            'username': 'student1',
            'academicStatus': 'ACTIVE',
            'courseStartDate': '2022-09-05',
            'courseEndDate': '2027-06-30',
            'currentTermActive': True,
            'hasCurrentSchedule': True,
            'registeredPermanentAddress': '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh'
        },
        'studentClaim': {
            'declaredAddress': '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
            'addressType': 'PERMANENT',
            'requestReason': 'Phục vụ tạm hoãn nghĩa vụ quân sự địa phương năm 2026'
        },
        'addressAnalysis': {
            'rawAddress': '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
            'parsed': {
                'houseNumber': '123',
                'street': 'Đường Lê Lợi',
                'ward': 'Phường Bến Nghé',
                'district': 'Quận 1',
                'province': 'TP. Hồ Chí Minh'
            },
            'normalized': '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
            'missingFields': [],
            'isComplete': True,
            'confidence': 0.98,
            'source': 'gemini'
        },
        'ocr': {
            'studentCode': 'SV2026-1001',
            'tamperRisk': 'LOW',
            'confidenceScore': 0.98,
            'confidence': 0.98,
            'modeUsed': 'live',
            'isLive': True,
            'isFallback': False,
            'isSynthetic': False
        },
        'files': [],
        'aiMetadata': {'modeUsed': 'live', 'isLive': True, 'fallbackOccurred': False, 'isFallback': False, 'isSynthetic': False},
        'expectedDecision': 'AUTO_APPROVE',
        'expectedReason': None
    },
    {
        'id': 'HARNESS-02-FORMAT-ONLY-PASS',
        'title': 'Khác biệt viết hoa/thường & viết tắt hành chính (P, Q, TPHCM)',
        'description': 'Địa chỉ sinh viên nhập viết thường/viết tắt nhưng đầy đủ cấp hành chính.',
        'category': 'MILITARY_SERVICE_CONFIRMATION',
        'priority': 'MEDIUM',
        'student': {
            'fullName': 'Nguyễn Văn An',
            'studentCode': 'SV2026-1001',
            'username': 'student1',
            'academicStatus': 'ACTIVE',
            'courseStartDate': '2022-09-05',
            'courseEndDate': '2027-06-30',
            'currentTermActive': True,
            'hasCurrentSchedule': True,
            'registeredPermanentAddress': '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh'
        },
        'studentClaim': {
            'declaredAddress': '123 le loi, p ben nghe, q1, tphcm',
            'addressType': 'PERMANENT',
            'requestReason': 'Bổ sung hồ sơ Ban chỉ huy quân sự'
        },
        'addressAnalysis': {
            'rawAddress': '123 le loi, p ben nghe, q1, tphcm',
            'parsed': {
                'houseNumber': '123',
                'street': 'Lê Lợi',
                'ward': 'Phường Bến Nghé',
                'district': 'Quận 1',
                'province': 'TP. Hồ Chí Minh'
            },
            'normalized': '123 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
            'missingFields': [],
            'isComplete': True,
            'confidence': 0.95,
            'source': 'gemini'
        },
        'ocr': {
            'studentCode': 'SV2026-1001',
            'tamperRisk': 'LOW',
            'confidenceScore': 0.95,
            'confidence': 0.95,
            'modeUsed': 'live',
            'isLive': True,
            'isFallback': False,
            'isSynthetic': False
        },
        'files': [],
        'aiMetadata': {'modeUsed': 'live', 'isLive': True, 'fallbackOccurred': False, 'isFallback': False, 'isSynthetic': False},
        'expectedDecision': 'AUTO_APPROVE',
        'expectedReason': None
    },
    {
        'id': 'HARNESS-03-FACT-UNKNOWN',
        'title': 'Thiếu thành phần địa chỉ bắt buộc (Không có Phường/Xã)',
        'description': 'Địa chỉ sinh viên nhập thiếu Phường/Xã khiến không thể đối soát thẩm quyền BCHQS.',
        'category': 'MILITARY_SERVICE_CONFIRMATION',
        'priority': 'MEDIUM',
        'student': {
            'fullName': 'Nguyễn Văn An',
            'studentCode': 'SV2026-1001',
            'username': 'student1',
            'academicStatus': 'ACTIVE',
            'registeredPermanentAddress': '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh'
        },
        'studentClaim': {
            'declaredAddress': '123 Đường Lê Lợi, Quận 1, TP. Hồ Chí Minh',
            'addressType': 'PERMANENT',
            'requestReason': 'Xin giấy hoãn nghĩa vụ quân sự'
        },
        'addressAnalysis': {
            'rawAddress': '123 Đường Lê Lợi, Quận 1, TP. Hồ Chí Minh',
            'parsed': {
                'houseNumber': '123',
                'street': 'Đường Lê Lợi',
                'ward': '',
                'district': 'Quận 1',
                'province': 'TP. Hồ Chí Minh'
            },
            'normalized': '123 Đường Lê Lợi, Quận 1, TP. Hồ Chí Minh',
            'missingFields': ['ward'],
            'isComplete': False,
            'confidence': 0.60,
            'source': 'gemini'
        },
        'ocr': {
            'studentCode': 'SV2026-1001',
            'tamperRisk': 'LOW',
            'confidenceScore': 0.60,
            'confidence': 0.60,
            'modeUsed': 'live',
            'isLive': True,
            'isFallback': False,
            'isSynthetic': False
        },
        'files': [],
        'aiMetadata': {'modeUsed': 'live', 'fallbackOccurred': False},
        'expectedDecision': 'ESCALATE_TO_HUMAN',
        'expectedReason': 'FACT_UNKNOWN'
    },
    {
        'id': 'HARNESS-04-TEMPORARY-ADDRESS',
        'title': 'Kê khai Địa chỉ Tạm trú thay vì Thường trú bắt buộc',
        'description': 'Theo Luật NVQS, giấy xác nhận hoãn NVQS bắt buộc gửi về nơi đăng ký thường trú.',
        'category': 'MILITARY_SERVICE_CONFIRMATION',
        'priority': 'MEDIUM',
        'student': {
            'fullName': 'Nguyễn Văn An',
            'studentCode': 'SV2026-1001',
            'username': 'student1',
            'academicStatus': 'ACTIVE',
            'registeredPermanentAddress': '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh'
        },
        'studentClaim': {
            'declaredAddress': 'Ký túc xá Khu B ĐHQG, Phường Đông Hòa, Dĩ An, Bình Dương',
            'addressType': 'TEMPORARY',
            'requestReason': 'Xin hoãn NVQS tại nơi ở trọ tạm trú'
        },
        'addressAnalysis': {
            'rawAddress': 'Ký túc xá Khu B ĐHQG, Phường Đông Hòa, Dĩ An, Bình Dương',
            'parsed': {
                'ward': 'Phường Đông Hòa',
                'district': 'TP. Dĩ An',
                'province': 'Bình Dương'
            },
            'normalized': 'Ký túc xá Khu B ĐHQG, Phường Đông Hòa, TP. Dĩ An, Bình Dương',
            'missingFields': [],
            'isComplete': True,
            'confidence': 0.95,
            'source': 'gemini'
        },
        'ocr': {
            'studentCode': 'SV2026-1001',
            'tamperRisk': 'LOW',
            'confidenceScore': 0.95,
            'confidence': 0.95,
            'modeUsed': 'live',
            'isLive': True,
            'isFallback': False,
            'isSynthetic': False
        },
        'files': [],
        'aiMetadata': {'modeUsed': 'live', 'fallbackOccurred': False},
        'expectedDecision': 'ESCALATE_TO_HUMAN',
        'expectedReason': 'DATA_CONFLICT'
    },
    {
        'id': 'HARNESS-05-MATERIAL-ADDRESS-CONFLICT',
        'title': 'Xung đột thực chất Hộ khẩu Thường trú gốc (TP.HCM vs Đà Nẵng)',
        'description': 'Hồ sơ gốc ghi thường trú TP.HCM nhưng sinh viên khai báo nhận giấy tại Hải Châu, Đà Nẵng.',
        'category': 'MILITARY_SERVICE_CONFIRMATION',
        'priority': 'MEDIUM',
        'student': {
            'fullName': 'Nguyễn Văn An',
            'studentCode': 'SV2026-1001',
            'username': 'student1',
            'academicStatus': 'ACTIVE',
            'registeredPermanentAddress': '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh'
        },
        'studentClaim': {
            'declaredAddress': '456 Đường Bạch Đằng, Phường Hải Châu 1, Quận Hải Châu, Đà Nẵng',
            'addressType': 'PERMANENT',
            'requestReason': 'Nộp cho BCHQS Quận Hải Châu Đà Nẵng'
        },
        'addressAnalysis': {
            'rawAddress': '456 Đường Bạch Đằng, Phường Hải Châu 1, Quận Hải Châu, Đà Nẵng',
            'parsed': {
                'houseNumber': '456',
                'street': 'Đường Bạch Đằng',
                'ward': 'Phường Hải Châu 1',
                'district': 'Quận Hải Châu',
                'province': 'Đà Nẵng'
            },
            'normalized': '456 Đường Bạch Đằng, Phường Hải Châu 1, Quận Hải Châu, Đà Nẵng',
            'missingFields': [],
            'isComplete': True,
            'confidence': 0.95,
            'source': 'gemini'
        },
        'ocr': {
            'studentCode': 'SV2026-1001',
            'tamperRisk': 'LOW',
            'confidenceScore': 0.95,
            'confidence': 0.95,
            'modeUsed': 'live',
            'isLive': True,
            'isFallback': False,
            'isSynthetic': False
        },
        'files': [],
        'aiMetadata': {'modeUsed': 'live', 'fallbackOccurred': False},
        'expectedDecision': 'ESCALATE_TO_HUMAN',
        'expectedReason': 'DATA_CONFLICT'
    },
    {
        'id': 'HARNESS-06-AUTHORITY-REQUIRED',
        'title': 'Trạng thái Đào tạo Tạm dừng / Cần Thẩm quyền Phòng Đào tạo',
        'description': 'Sinh viên đang bị đình chỉ hoặc tạm dừng học tập (SUSPENDED), cần Hội đồng/Phòng Đào tạo quyết định.',
        'category': 'MILITARY_SERVICE_CONFIRMATION',
        'priority': 'HIGH',
        'student': {
            'fullName': 'Nguyễn Văn An',
            'studentCode': 'SV2026-1001',
            'username': 'student1',
            'academicStatus': 'SUSPENDED',
            'registeredPermanentAddress': '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh'
        },
        'studentClaim': {
            'declaredAddress': '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
            'addressType': 'PERMANENT',
            'requestReason': 'Xin xác nhận dù đang trong thời gian bảo lưu'
        },
        'addressAnalysis': {
            'rawAddress': '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
            'parsed': {
                'houseNumber': '123',
                'street': 'Đường Lê Lợi',
                'ward': 'Phường Bến Nghé',
                'district': 'Quận 1',
                'province': 'TP. Hồ Chí Minh'
            },
            'normalized': '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
            'missingFields': [],
            'isComplete': True,
            'confidence': 0.98,
            'source': 'gemini'
        },
        'ocr': {
            'studentCode': 'SV2026-1001',
            'tamperRisk': 'LOW',
            'confidenceScore': 0.98,
            'confidence': 0.98,
            'modeUsed': 'live',
            'isLive': True,
            'isFallback': False,
            'isSynthetic': False
        },
        'files': [],
        'aiMetadata': {'modeUsed': 'live', 'fallbackOccurred': False},
        'expectedDecision': 'ESCALATE_TO_HUMAN',
        'expectedReason': 'AUTHORITY_REQUIRED'
    },
    {
        'id': 'HARNESS-07-POLICY-OUT-OF-SCOPE',
        'title': 'Yêu cầu Ngoại lệ Ngoài Thẩm quyền (Xin hoãn vượt khóa đào tạo)',
        'description': 'Đơn xin cấp giấy kéo dài thời gian hoãn vượt quá thời gian thiết kế của khóa học.',
        'category': 'MILITARY_SERVICE_CONFIRMATION',
        'priority': 'MEDIUM',
        'student': {
            'fullName': 'Nguyễn Văn An',
            'studentCode': 'SV2026-1001',
            'username': 'student1',
            'academicStatus': 'ACTIVE',
            'registeredPermanentAddress': '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh'
        },
        'studentClaim': {
            'declaredAddress': '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
            'addressType': 'PERMANENT',
            'requestReason': 'Kính xin Ban Giám hiệu xem xét đặc cách hoãn nghĩa vụ vượt khóa đào tạo quy định'
        },
        'addressAnalysis': {
            'rawAddress': '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
            'parsed': {
                'houseNumber': '123',
                'street': 'Đường Lê Lợi',
                'ward': 'Phường Bến Nghé',
                'district': 'Quận 1',
                'province': 'TP. Hồ Chí Minh'
            },
            'normalized': '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
            'missingFields': [],
            'isComplete': True,
            'confidence': 0.98,
            'source': 'gemini'
        },
        'ocr': {
            'studentCode': 'SV2026-1001',
            'tamperRisk': 'LOW',
            'confidenceScore': 0.98,
            'confidence': 0.98,
            'modeUsed': 'live',
            'isLive': True,
            'isFallback': False,
            'isSynthetic': False
        },
        'files': [],
        'aiMetadata': {'modeUsed': 'live', 'fallbackOccurred': False},
        'expectedDecision': 'ESCALATE_TO_HUMAN',
        'expectedReason': 'POLICY_OUT_OF_SCOPE'
    },
    {
        'id': 'HARNESS-08-OWNERSHIP-UNCLEAR',
        'title': 'Chủ quyền hồ sơ không rõ (Lệch MSSV tài khoản)',
        'description': 'Mã số sinh viên kê khai hoặc dữ liệu sinh viên không trùng khớp thông tin tài khoản đăng nhập.',
        'category': 'MILITARY_SERVICE_CONFIRMATION',
        'priority': 'MEDIUM',
        'student': {
            'fullName': 'Nguyễn Văn An',
            'studentCode': 'SV2026-1001',
            'username': 'student1',
            'academicStatus': 'ACTIVE',
            'registeredPermanentAddress': '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh'
        },
        'studentClaim': {
            'declaredAddress': '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
            'addressType': 'PERMANENT',
            'requestReason': 'Xin giấy xác nhận tạm hoãn NVQS'
        },
        'addressAnalysis': {
            'rawAddress': '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
            'parsed': {
                'houseNumber': '123',
                'street': 'Đường Lê Lợi',
                'ward': 'Phường Bến Nghé',
                'district': 'Quận 1',
                'province': 'TP. Hồ Chí Minh'
            },
            'normalized': '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
            'missingFields': [],
            'isComplete': True,
            'confidence': 0.98,
            'source': 'gemini'
        },
        'ocr': {
            'studentCode': 'SV2026-9999',
            'tamperRisk': 'LOW',
            'confidenceScore': 0.98,
            'confidence': 0.98,
            'modeUsed': 'live',
            'isLive': True,
            'isFallback': False,
            'isSynthetic': False
        },
        'files': [],
        'aiMetadata': {'modeUsed': 'live', 'fallbackOccurred': False},
        'expectedDecision': 'ESCALATE_TO_HUMAN',
        'expectedReason': 'OWNERSHIP_UNCLEAR'
    },
    {
        'id': 'HARNESS-09-NON-LIVE-FAILSAFE',
        'title': 'Cơ chế An toàn Fail-safe khi AI chạy chế độ Mock/Fallback',
        'description': 'Khi hệ thống AI không ở chế độ Live (hoặc kích hoạt Fallback), hệ thống từ chối tự động duyệt.',
        'category': 'MILITARY_SERVICE_CONFIRMATION',
        'priority': 'MEDIUM',
        'student': {
            'fullName': 'Nguyễn Văn An',
            'studentCode': 'SV2026-1001',
            'username': 'student1',
            'academicStatus': 'ACTIVE',
            'registeredPermanentAddress': '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh'
        },
        'studentClaim': {
            'declaredAddress': '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
            'addressType': 'PERMANENT',
            'requestReason': 'Xin giấy hoãn NVQS'
        },
        'addressAnalysis': {
            'rawAddress': '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
            'parsed': {
                'houseNumber': '123',
                'street': 'Đường Lê Lợi',
                'ward': 'Phường Bến Nghé',
                'district': 'Quận 1',
                'province': 'TP. Hồ Chí Minh'
            },
            'normalized': '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
            'missingFields': [],
            'isComplete': True,
            'confidence': 0.98,
            'source': 'mock'
        },
        'ocr': {
            'studentCode': 'SV2026-1001',
            'tamperRisk': 'LOW',
            'confidenceScore': 0.98,
            'confidence': 0.98,
            'modeUsed': 'mock',
            'isLive': False,
            'isFallback': True,
            'isSynthetic': False
        },
        'files': [],
        'aiMetadata': {'modeUsed': 'mock', 'fallbackOccurred': True},
        'expectedDecision': 'ESCALATE_TO_HUMAN',
        'expectedReason': 'FACT_UNKNOWN'
    }
]


def run_verify_harness() -> Dict[str, Any]:
    """
    Thực thi toàn bộ bộ kiểm chuẩn xác định (Deterministic Verify Harness).
    Không ghi đè hoặc can thiệp CSDL.
    """
    run_id = f"VRF-{int(datetime.now().timestamp())}-{secrets.token_hex(2).upper()}"
    timestamp = datetime.utcnow().isoformat() + 'Z'
    results: List[Dict[str, Any]] = []

    passed_count = 0
    failed_count = 0

    for item in HARNESS_CASES:
        t0 = time.time()

        case_ai_meta = item.get('aiMetadata', {})

        # Chuẩn bị hồ sơ sinh viên đầy đủ cho fixture kiểm thử
        st_info = dict(item.get('student', {}))
        if 'currentTermActive' not in st_info:
            st_info['currentTermActive'] = (st_info.get('academicStatus') == 'ACTIVE')
        if 'hasCurrentSchedule' not in st_info:
            st_info['hasCurrentSchedule'] = (st_info.get('academicStatus') == 'ACTIVE')
        if 'courseStartDate' not in st_info:
            st_info['courseStartDate'] = '2022-09-05'
        if 'courseEndDate' not in st_info:
            st_info['courseEndDate'] = '2027-06-30'

        # Tạo payload test độc lập (Isolated context, không sửa global state)
        case_data = {
            'id': item['id'],
            'title': item['title'],
            'description': item['description'],
            'category': item['category'],
            'priority': item['priority'],
            'evidenceFiles': item.get('files', []),
            'aiMetadata': case_ai_meta,
            'studentClaim': item.get('studentClaim', {}),
            'institutionalFacts': st_info,
            'authoritativeInstitutionalFacts': st_info,
            'addressAnalysis': item.get('addressAnalysis', {})
        }

        # Inject OCR data vào files nếu có
        if item.get('files'):
            case_data['evidenceFiles'][0]['ocrData'] = item['ocr']

        # Chạy Rule Engine với ai_context độc lập, thread-safe
        verdict = evaluate_case(
            case_data=case_data,
            ocr_data=item.get('ocr'),
            student_user=st_info,
            ai_context=case_ai_meta
        )
        duration_ms = round((time.time() - t0) * 1000, 2)

        actual_decision = verdict.get('decision')
        actual_reason = verdict.get('escalationReason')

        decision_ok = actual_decision == item['expectedDecision']
        reason_ok = (item['expectedReason'] is None and actual_reason is None) or (actual_reason == item['expectedReason'])

        test_passed = decision_ok and reason_ok
        if test_passed:
            passed_count += 1
        else:
            failed_count += 1

        results.append({
            'caseId': item['id'],
            'caseName': item['title'],
            'expectedDecision': item['expectedDecision'],
            'actualDecision': actual_decision,
            'expectedReason': item['expectedReason'],
            'actualReason': actual_reason,
            'ruleMatched': verdict.get('ruleMatched'),
            'explanation': verdict.get('explanation'),
            'confidence': verdict.get('confidence'),
            'pass': test_passed,
            'durationMs': duration_ms
        })

    return {
        'runId': run_id,
        'timestamp': timestamp,
        'disclaimer': 'PASS/FAIL do bộ quy tắc xác định; Gemini chỉ rà soát bổ sung khi API khả dụng.',
        'verificationType': 'DETERMINISTIC_RULE_ENGINE',
        'total': len(HARNESS_CASES),
        'passed': passed_count,
        'failed': failed_count,
        'status': 'ALL_PASSED' if failed_count == 0 else 'HAS_FAILURES',
        'results': results
    }
