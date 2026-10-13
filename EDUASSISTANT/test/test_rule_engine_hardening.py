"""Focused regression tests for fail-closed NVQS routing rules."""
import os
import sys
import unittest
from datetime import datetime, timedelta

BACKEND = os.path.join(os.path.dirname(__file__), '..', 'backend')
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

from app.services.rule_engine import evaluate_case


class RuleEngineHardeningTests(unittest.TestCase):
    def setUp(self):
        today = datetime.utcnow().date()
        self.student = {
            'studentCode': 'SV2026-1001', 'fullName': 'Nguyen Van A',
            'sourceType': 'SYNTHETIC_TEST_SIS', 'verificationStatus': 'TEST_VERIFIED',
            'academicStatus': 'ACTIVE', 'currentTermActive': True,
            'hasCurrentSchedule': True,
            'courseStartDate': (today - timedelta(days=30)).isoformat(),
            'courseEndDate': (today + timedelta(days=30)).isoformat(),
            'registeredPermanentAddress': '123 Le Loi, Ben Nghe, Quan 1, Ho Chi Minh',
            'source': 'VERIFIED_INSTITUTIONAL_SIS',
        }
        self.ai_context = {
            'modeUsed': 'fixture', 'isLive': False, 'isFallback': False,
            'isSynthetic': True, 'provider': 'FIXED_TEST_FIXTURE', 'apiCallPerformed': False,
        }
        self.evaluation_context = {
            'evaluationMode': 'DETERMINISTIC_TEST',
            'allowSyntheticVerifiedInstitutionalFacts': True,
            'allowSyntheticAIAnalysis': True,
        }

    def case(self):
        return {
            'studentCode': 'SV2026-1001', 'studentName': 'Nguyen Van A',
            'institutionalFacts': dict(self.student),
            'studentClaim': {'studentCode': 'SV2026-1001', 'fullName': 'Nguyen Van A',
                             'addressType': 'PERMANENT',
                             'declaredAddress': '123 Le Loi, Ben Nghe, Quan 1, Ho Chi Minh'},
            'addressAnalysis': {'normalized': '123 Le Loi, Ben Nghe, Quan 1, Ho Chi Minh',
                                'parsed': {'houseNumber': '123', 'street': 'Le Loi', 'ward': 'Ben Nghe',
                                           'district': 'Quan 1', 'province': 'Ho Chi Minh'},
                                'missingFields': [], 'confidence': .95},
        }

    def verdict(self, case, evaluation_context=None):
        context = {**self.evaluation_context, **(evaluation_context or {})}
        return evaluate_case(
            case,
            student_user=self.student,
            ai_context=self.ai_context,
            evaluation_context=context,
        )

    def test_internal_demo_record_unverified_escalates(self):
        case = self.case()
        case['institutionalFacts'].update({
            'sourceType': 'INTERNAL_DEMO_SIS',
            'verificationStatus': 'UNVERIFIED',
        })
        result = self.verdict(case, {'allowAdminVerifiedDemoSIS': True})
        self.assertEqual(result['escalationReason'], 'FACT_UNKNOWN')
        self.assertEqual(result['institutionalTrust'], 'UNVERIFIED')

    def test_admin_verified_demo_is_trusted_only_when_enabled(self):
        case = self.case()
        case['institutionalFacts'].update({
            'sourceType': 'INTERNAL_DEMO_SIS',
            'verificationStatus': 'ADMIN_VERIFIED_DEMO',
        })
        result = self.verdict(case, {'allowAdminVerifiedDemoSIS': True})
        self.assertEqual(result['decision'], 'AUTO_APPROVE')
        self.assertEqual(result['institutionalTrust'], 'ADMIN_VERIFIED_DEMO')

    def test_admin_verified_demo_escalates_when_disabled(self):
        case = self.case()
        case['institutionalFacts'].update({
            'sourceType': 'INTERNAL_DEMO_SIS',
            'verificationStatus': 'ADMIN_VERIFIED_DEMO',
        })
        result = self.verdict(case, {'allowAdminVerifiedDemoSIS': False})
        self.assertEqual(result['escalationReason'], 'FACT_UNKNOWN')

    def test_external_verified_record_is_trusted(self):
        case = self.case()
        case['institutionalFacts'].update({
            'sourceType': 'EXTERNAL_INSTITUTIONAL_SIS',
            'verificationStatus': 'EXTERNAL_VERIFIED',
        })
        result = self.verdict(case, {'allowAdminVerifiedDemoSIS': False})
        self.assertEqual(result['decision'], 'AUTO_APPROVE')
        self.assertEqual(result['institutionalTrust'], 'EXTERNAL_VERIFIED')

    def test_legacy_account_does_not_establish_trust(self):
        case = self.case()
        case['institutionalFacts'].update({
            'sourceType': 'LEGACY_ACCOUNT',
            'verificationStatus': 'UNVERIFIED',
        })
        self.assertEqual(self.verdict(case)['escalationReason'], 'FACT_UNKNOWN')

    def test_synthetic_test_record_requires_explicit_test_context(self):
        case = self.case()
        result = evaluate_case(case, student_user=self.student, ai_context=self.ai_context)
        self.assertEqual(result['escalationReason'], 'FACT_UNKNOWN')

    def test_deterministic_test_context_does_not_read_adaptive_threshold(self):
        from unittest.mock import patch
        with patch('app.services.rule_engine.get_confidence_threshold', side_effect=AssertionError('database access')):
            self.assertEqual(self.verdict(self.case())['decision'], 'AUTO_APPROVE')

    def test_exact_student_code_matches(self):
        self.assertEqual(self.verdict(self.case())['decision'], 'AUTO_APPROVE')

    def test_missing_institutional_provenance_requires_human_review(self):
        case = self.case()
        case['institutionalFacts'].pop('source')
        case['institutionalFacts'].pop('sourceType')
        case['institutionalFacts'].pop('verificationStatus')
        result = self.verdict(case)
        self.assertEqual(result['escalationReason'], 'FACT_UNKNOWN')
        self.assertEqual(result['ruleMatched'], 'RULE_FAILSAFE_UNVERIFIED_INSTITUTIONAL_RECORD')
    def test_student_code_substring_does_not_match(self):
        case = self.case(); case['studentCode'] = case['studentClaim']['studentCode'] = 'SV2026-10'
        self.assertEqual(self.verdict(case)['escalationReason'], 'OWNERSHIP_UNCLEAR')

    def test_name_substring_does_not_match(self):
        case = self.case(); case['studentName'] = case['studentClaim']['fullName'] = 'Nguyen Van A'
        self.student['fullName'] = case['institutionalFacts']['fullName'] = 'Nguyen Van Anh'
        self.assertEqual(self.verdict(case)['escalationReason'], 'OWNERSHIP_UNCLEAR')

    def test_name_case_and_whitespace_normalization_matches(self):
        case = self.case(); case['studentName'] = case['studentClaim']['fullName'] = '  nguyen   van a  '
        self.assertEqual(self.verdict(case)['decision'], 'AUTO_APPROVE')

    def test_missing_authoritative_full_name_is_unclear(self):
        self.student['fullName'] = None
        case = self.case(); case['institutionalFacts']['fullName'] = None
        self.assertEqual(self.verdict(case)['escalationReason'], 'OWNERSHIP_UNCLEAR')

    def test_missing_authoritative_student_code_is_unclear(self):
        self.student['studentCode'] = None
        case = self.case(); case['institutionalFacts']['studentCode'] = None
        self.assertEqual(self.verdict(case)['escalationReason'], 'OWNERSHIP_UNCLEAR')

    def test_missing_or_invalid_course_dates_require_authority(self):
        for key, value in [('courseStartDate', None), ('courseEndDate', None), ('courseStartDate', 'not-a-date')]:
            with self.subTest(key=key, value=value):
                case = self.case(); case['institutionalFacts'][key] = value
                self.student[key] = value
                self.assertEqual(self.verdict(case)['escalationReason'], 'AUTHORITY_REQUIRED')

    def test_outside_course_range_requires_authority(self):
        today = datetime.utcnow().date()
        for start, end in [(today + timedelta(days=1), today + timedelta(days=20)),
                           (today - timedelta(days=20), today - timedelta(days=1))]:
            with self.subTest(start=start):
                case = self.case(); case['institutionalFacts']['courseStartDate'] = start.isoformat(); case['institutionalFacts']['courseEndDate'] = end.isoformat()
                self.assertEqual(self.verdict(case)['escalationReason'], 'AUTHORITY_REQUIRED')


if __name__ == '__main__':
    unittest.main()
