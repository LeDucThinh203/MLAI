"""Optional live address-AI end-to-end sanity check; not a Track benchmark."""
import asyncio
import json
import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_ROOT = os.path.join(PROJECT_ROOT, 'backend')
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from app.services.address_ai_service import normalize_student_address
from app.services.rule_engine import evaluate_case


SCENARIOS = [
    ('LIVE-01-STANDARD', 'Địa chỉ chuẩn', '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh'),
    ('LIVE-02-SHORTCUTS', 'Địa chỉ viết tắt', '123 le loi, p ben nghe, q1, tphcm'),
    ('LIVE-03-MISSING-WARD', 'Thiếu phường', '123 Đường Lê Lợi, Quận 1, TP. Hồ Chí Minh'),
    ('LIVE-04-CONFLICT', 'Địa chỉ mâu thuẫn', '12 Nguyễn Trãi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh'),
    ('LIVE-05-AMBIGUOUS', 'Đầu vào khó', '123/4 Lê Lợi, khu phố gần chợ Bến Thành, TP HCM'),
]

SYNTHETIC_STUDENT = {
    'studentCode': 'LIVE-TEST-001',
    'fullName': 'Nguyen Van A',
    'academicStatus': 'ACTIVE',
    'courseStartDate': '2022-09-05',
    'courseEndDate': '2027-06-30',
    'currentTermActive': True,
    'hasCurrentSchedule': True,
    'registeredPermanentAddress': '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    'sourceType': 'SYNTHETIC_TEST_SIS',
    'verificationStatus': 'TEST_VERIFIED',
}


async def run_live_ai_eval():
    results = []
    for case_id, name, address in SCENARIOS:
        address_result = await normalize_student_address(
            address,
            'PERMANENT',
            {'id': 'LIVE_AI_EVAL', 'username': 'live_ai_eval', 'role': 'SYSTEM'},
        )
        ai_context = {
            'modeUsed': address_result.get('modeUsed'),
            'isLive': address_result.get('isLive'),
            'isFallback': address_result.get('isFallback'),
            'isSynthetic': address_result.get('isSynthetic'),
        }
        case_data = {
            'id': case_id,
            'studentCode': SYNTHETIC_STUDENT['studentCode'],
            'studentName': SYNTHETIC_STUDENT['fullName'],
            'studentClaim': {
                'studentCode': SYNTHETIC_STUDENT['studentCode'],
                'fullName': SYNTHETIC_STUDENT['fullName'],
                'addressType': 'PERMANENT',
                'declaredAddress': address,
            },
            'institutionalFacts': dict(SYNTHETIC_STUDENT),
            'addressAnalysis': address_result,
            'aiMetadata': ai_context,
        }
        verdict = evaluate_case(
            case_data,
            student_user=dict(SYNTHETIC_STUDENT),
            ai_context=ai_context,
            evaluation_context={
                'evaluationMode': 'DETERMINISTIC_TEST',
                'allowSyntheticVerifiedInstitutionalFacts': True,
            },
        )
        results.append({
            'caseId': case_id,
            'caseName': name,
            'input': address,
            'provider': address_result.get('provider'),
            'model': address_result.get('model'),
            'apiCallPerformed': bool(address_result.get('apiCallPerformed')),
            'apiAttempts': address_result.get('apiAttempts', 0),
            'latencyMs': address_result.get('durationMs'),
            'parsedFields': address_result.get('parsed') or {},
            'confidence': address_result.get('confidence'),
            'fallbackStatus': 'FALLBACK' if address_result.get('isFallback') else 'NONE',
            'ruleDecision': verdict.get('decision'),
            'escalationReason': verdict.get('escalationReason'),
        })

    providers = sorted({item['provider'] for item in results if item.get('provider')})
    models = sorted({item['model'] for item in results if item.get('model')})
    return {
        'evaluationType': 'LIVE_AI_END_TO_END_SANITY_CHECK',
        'aiCallsPerformed': any(item['apiCallPerformed'] for item in results),
        'provider': providers[0] if len(providers) == 1 else (providers or ['NONE']),
        'model': models[0] if len(models) == 1 else (models or ['NONE']),
        'cases': len(results),
        'liveSuccessCount': sum(1 for item in results if item['provider'] != 'DETERMINISTIC_PARSER'),
        'fallbackCount': sum(1 for item in results if item['fallbackStatus'] == 'FALLBACK'),
        'apiAttempts': sum(item['apiAttempts'] for item in results),
        'results': results,
    }


if __name__ == '__main__':
    print(json.dumps(asyncio.run(run_live_ai_eval()), ensure_ascii=False, indent=2))
