"""Regression coverage for benchmark institutional-fact provenance."""
import json
import os
import sys
import unittest

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
BACKEND = os.path.join(PROJECT_ROOT, 'backend')
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from app.services.rule_engine import evaluate_case
from benchmark.run_benchmark import build_evaluation_input


class BenchmarkProvenanceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(os.path.join(PROJECT_ROOT, 'benchmark', 'held_out_cases.json'), encoding='utf-8') as source:
            cls.cases = {case['id']: case for case in json.load(source)}

    def test_bench_01_marks_institutional_facts_as_test_verified(self):
        case = self.cases['BENCH-01-ROUTINE-ACTIVE']
        self.assertNotIn('source', case.get('student') or {})
        self.assertTrue(case.get('institutionalFacts'))

        payload, student_user, ocr_data, ai_context, evaluation_context = build_evaluation_input(case)
        facts = payload['institutionalFacts']
        self.assertEqual(facts['sourceType'], 'SYNTHETIC_TEST_SIS')
        self.assertEqual(facts['verificationStatus'], 'TEST_VERIFIED')
        self.assertEqual(student_user['sourceType'], facts['sourceType'])
        self.assertEqual(student_user['verificationStatus'], facts['verificationStatus'])

        verdict = evaluate_case(
            payload,
            ocr_data,
            student_user,
            ai_context=ai_context,
            evaluation_context=evaluation_context,
        )
        self.assertEqual(verdict['decision'], 'AUTO_APPROVE')

    def test_bench_18_unverified_sis_fixture_escalates(self):
        case = self.cases['BENCH-18-FAILSAFE-FALLBACK-TRIGGERED']
        self.assertIs(case.get('benchmarkSISVerified'), False)

        payload, student_user, ocr_data, ai_context, evaluation_context = build_evaluation_input(case)
        self.assertEqual(payload['institutionalFacts']['sourceType'], 'SYNTHETIC_TEST_SIS')
        self.assertEqual(payload['institutionalFacts']['verificationStatus'], 'UNVERIFIED')
        verdict = evaluate_case(
            payload,
            ocr_data,
            student_user,
            ai_context=ai_context,
            evaluation_context=evaluation_context,
        )
        self.assertEqual(verdict['decision'], 'ESCALATE_TO_HUMAN')
        self.assertEqual(verdict['escalationReason'], 'FACT_UNKNOWN')


if __name__ == '__main__':
    unittest.main()
