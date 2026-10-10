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
            'academicStatus': 'ACTIVE', 'currentTermActive': True,
            'hasCurrentSchedule': True,
            'courseStartDate': (today - timedelta(days=30)).isoformat(),
            'courseEndDate': (today + timedelta(days=30)).isoformat(),
            'registeredPermanentAddress': '123 Le Loi, Ben Nghe, Quan 1, Ho Chi Minh',
        }
        self.ai_context = {'modeUsed': 'live', 'isLive': True, 'isFallback': False, 'isSynthetic': False}

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

    def verdict(self, case):
        return evaluate_case(case, student_user=self.student, ai_context=self.ai_context)

    def test_exact_student_code_matches(self):
        self.assertEqual(self.verdict(self.case())['decision'], 'AUTO_APPROVE')

    def test_student_code_substring_does_not_match(self):
        case = self.case(); case['studentCode'] = case['studentClaim']['studentCode'] = 'SV2026-10'
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
