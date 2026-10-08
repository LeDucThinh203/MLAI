"""
============================================================================
EDUASSISTANT - DETERMINISTIC VERIFY HARNESS SERVICE
============================================================================
Bộ thẩm định kiểm chuẩn tự động một chạm (One-click Verify Harness)
dành cho Giám khảo và Hội đồng đánh giá Hackathon MLAI 2026.
Chạy in-memory hoàn toàn độc lập, không thay đổi dữ liệu thật trong CSDL:
  1. Routine Valid Case         -> Expected: AUTO_APPROVE
  2. FACT_UNKNOWN Case          -> Expected: ESCALATE_TO_HUMAN (FACT_UNKNOWN)
  3. DATA_CONFLICT Case         -> Expected: ESCALATE_TO_HUMAN (DATA_CONFLICT)
  4. AUTHORITY_REQUIRED Case     -> Expected: ESCALATE_TO_HUMAN (AUTHORITY_REQUIRED)
  5. POLICY_OUT_OF_SCOPE Case   -> Expected: ESCALATE_TO_HUMAN (POLICY_OUT_OF_SCOPE)
  6. OWNERSHIP_UNCLEAR Case     -> Expected: ESCALATE_TO_HUMAN (OWNERSHIP_UNCLEAR)
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
        'title': 'Hồ sơ Miễn giảm học phí Hợp lệ chuẩn (Live OCR)',
        'description': 'Đơn đề nghị miễn giảm học phí diện chính sách với giấy xác nhận hợp lệ từ UBND.',
        'category': 'TUITION_DISCOUNT',
        'priority': 'MEDIUM',
        'student': {
            'fullName': 'Nguyễn Văn An',
            'studentCode': 'SV2026-1001',
            'username': 'student1'
        },
        'ocr': {
            'documentType': 'Giấy xác nhận Cận nghèo',
            'studentName': 'Nguyễn Văn An',
            'studentCode': 'SV2026-1001',
            'issuingAuthority': 'UBND Phường Linh Trung',
            'certificateNumber': 'HN-2026-8888',
            'suggestedCategory': 'TUITION_DISCOUNT',
            'tamperRisk': 'LOW',
            'confidenceScore': 0.98,
            'confidence': 0.98,
            'modeUsed': 'live',
            'isLive': True,
            'isFallback': False,
            'isSynthetic': False
        },
        'files': [{'fileName': 'giay_can_ngheo.pdf', 'ocrData': None}],
        'aiMetadata': {'modeUsed': 'live', 'fallbackOccurred': False},
        'expectedDecision': 'AUTO_APPROVE',
        'expectedReason': None
    },
    {
        'id': 'HARNESS-02-FACT-UNKNOWN',
        'title': 'Hồ sơ Thiếu minh chứng hoặc Ảnh mờ / Độ tin cậy thấp',
        'description': 'Tài liệu nộp thiếu cơ quan ban hành hoặc ảnh mờ dưới ngưỡng tin cậy an toàn.',
        'category': 'TUITION_DISCOUNT',
        'priority': 'MEDIUM',
        'student': {
            'fullName': 'Nguyễn Văn An',
            'studentCode': 'SV2026-1001',
            'username': 'student1'
        },
        'ocr': {
            'documentType': 'Giấy xác nhận',
            'studentName': 'Nguyễn Văn An',
            'studentCode': 'SV2026-1001',
            'issuingAuthority': None,
            'certificateNumber': None,
            'suggestedCategory': 'TUITION_DISCOUNT',
            'tamperRisk': 'LOW',
            'confidenceScore': 0.52,
            'confidence': 0.52,
            'modeUsed': 'live',
            'isLive': True,
            'isFallback': False,
            'isSynthetic': False
        },
        'files': [{'fileName': 'anh_mo.jpg'}],
        'aiMetadata': {'modeUsed': 'live', 'fallbackOccurred': False},
        'expectedDecision': 'ESCALATE_TO_HUMAN',
        'expectedReason': 'FACT_UNKNOWN'
    },
    {
        'id': 'HARNESS-03-DATA-CONFLICT',
        'title': 'Mâu thuẫn Danh mục Kê khai và Minh chứng thực tế',
        'description': 'Khai báo Miễn giảm học phí nhưng tệp minh chứng đính kèm lại là Giấy chứng nhận Mùa hè xanh.',
        'category': 'TUITION_DISCOUNT',
        'priority': 'MEDIUM',
        'student': {
            'fullName': 'Nguyễn Văn An',
            'studentCode': 'SV2026-1001',
            'username': 'student1'
        },
        'ocr': {
            'documentType': 'Giấy chứng nhận Chiến dịch Tình nguyện',
            'studentName': 'Nguyễn Văn An',
            'studentCode': 'SV2026-1001',
            'issuingAuthority': 'Đoàn Thanh Niên Trường',
            'certificateNumber': 'MHX-2026-1234',
            'suggestedCategory': 'COMMUNITY_SERVICE',
            'tamperRisk': 'LOW',
            'confidenceScore': 0.95,
            'confidence': 0.95,
            'modeUsed': 'live',
            'isLive': True,
            'isFallback': False,
            'isSynthetic': False
        },
        'files': [{'fileName': 'chung_nhan_mhx.pdf'}],
        'aiMetadata': {'modeUsed': 'live', 'fallbackOccurred': False},
        'expectedDecision': 'ESCALATE_TO_HUMAN',
        'expectedReason': 'DATA_CONFLICT'
    },
    {
        'id': 'HARNESS-04-AUTHORITY-REQUIRED',
        'title': 'Vượt Thẩm quyền Tự động / Cần Hội đồng xét duyệt',
        'description': 'Đơn Phúc khảo điểm thi hoặc Đơn có mức độ Ưu tiên CAO (HIGH).',
        'category': 'GRADE_APPEAL',
        'priority': 'HIGH',
        'student': {
            'fullName': 'Nguyễn Văn An',
            'studentCode': 'SV2026-1001',
            'username': 'student1'
        },
        'ocr': {
            'documentType': 'Biên bản phúc khảo bài thi',
            'studentName': 'Nguyễn Văn An',
            'studentCode': 'SV2026-1001',
            'issuingAuthority': 'Phòng Khảo thí & Đảm bảo Chất lượng',
            'certificateNumber': 'PK-2026-9901',
            'suggestedCategory': 'GRADE_APPEAL',
            'tamperRisk': 'LOW',
            'confidenceScore': 0.97,
            'confidence': 0.97,
            'modeUsed': 'live',
            'isLive': True,
            'isFallback': False,
            'isSynthetic': False
        },
        'files': [{'fileName': 'phuc_khao.pdf'}],
        'aiMetadata': {'modeUsed': 'live', 'fallbackOccurred': False},
        'expectedDecision': 'ESCALATE_TO_HUMAN',
        'expectedReason': 'AUTHORITY_REQUIRED'
    },
    {
        'id': 'HARNESS-05-POLICY-OUT-OF-SCOPE',
        'title': 'Ngoài Phạm vi Chính sách Tự động (Yêu cầu ngoại lệ)',
        'description': 'Đơn diện Khác (GENERAL) hoặc chứa từ khóa xin cứu xét đặc cách.',
        'category': 'GENERAL',
        'priority': 'MEDIUM',
        'student': {
            'fullName': 'Nguyễn Văn An',
            'studentCode': 'SV2026-1001',
            'username': 'student1'
        },
        'ocr': {
            'documentType': 'Đơn giải trình hoàn cảnh',
            'studentName': 'Nguyễn Văn An',
            'studentCode': 'SV2026-1001',
            'issuingAuthority': 'Ủy ban Xã',
            'certificateNumber': 'DOC-2026-7788',
            'suggestedCategory': 'GENERAL',
            'tamperRisk': 'LOW',
            'confidenceScore': 0.90,
            'confidence': 0.90,
            'modeUsed': 'live',
            'isLive': True,
            'isFallback': False,
            'isSynthetic': False
        },
        'files': [{'fileName': 'don_ngoai_le.pdf'}],
        'aiMetadata': {'modeUsed': 'live', 'fallbackOccurred': False},
        'expectedDecision': 'ESCALATE_TO_HUMAN',
        'expectedReason': 'POLICY_OUT_OF_SCOPE'
    },
    {
        'id': 'HARNESS-06-OWNERSHIP-UNCLEAR',
        'title': 'Nghi vấn Quyền sở hữu / MSSV & Họ tên không trùng khớp',
        'description': 'Tài khoản nộp đơn là sinh viên A nhưng văn bản minh chứng lại mang tên sinh viên B.',
        'category': 'TUITION_DISCOUNT',
        'priority': 'MEDIUM',
        'student': {
            'fullName': 'Nguyễn Văn An',
            'studentCode': 'SV2026-1001',
            'username': 'student1'
        },
        'ocr': {
            'documentType': 'Giấy xác nhận Cận nghèo',
            'studentName': 'Trần Thị Bích',
            'studentCode': 'SV2026-9999',
            'issuingAuthority': 'UBND Phường Tam Phú',
            'certificateNumber': 'HN-2026-5544',
            'suggestedCategory': 'TUITION_DISCOUNT',
            'tamperRisk': 'LOW',
            'confidenceScore': 0.96,
            'confidence': 0.96,
            'modeUsed': 'live',
            'isLive': True,
            'isFallback': False,
            'isSynthetic': False
        },
        'files': [{'fileName': 'can_ngheo_khac_ten.pdf'}],
        'aiMetadata': {'modeUsed': 'live', 'fallbackOccurred': False},
        'expectedDecision': 'ESCALATE_TO_HUMAN',
        'expectedReason': 'OWNERSHIP_UNCLEAR'
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

    from app.services.ai_service import get_ai_mode, set_ai_mode
    prev_mode = get_ai_mode()

    try:
        for item in HARNESS_CASES:
            t0 = time.time()
            
            # Đảm bảo context test xác định không phụ thuộc mode môi trường ngẫu nhiên
            case_mode = item.get('aiMetadata', {}).get('modeUsed', 'live')
            set_ai_mode(case_mode)

            # Tạo payload test độc lập
            case_data = {
                'id': item['id'],
                'title': item['title'],
                'description': item['description'],
                'category': item['category'],
                'priority': item['priority'],
                'evidenceFiles': item['files'],
                'aiMetadata': item['aiMetadata']
            }
            
            # Inject OCR data vào files[0]
            if item['files']:
                case_data['evidenceFiles'][0]['ocrData'] = item['ocr']

            # Chạy Rule Engine
            verdict = evaluate_case(case_data, item['ocr'], item['student'])
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
    finally:
        set_ai_mode(prev_mode)

    return {
        'runId': run_id,
        'timestamp': timestamp,
        'total': len(HARNESS_CASES),
        'passed': passed_count,
        'failed': failed_count,
        'status': 'ALL_PASSED' if failed_count == 0 else 'HAS_FAILURES',
        'results': results
    }
