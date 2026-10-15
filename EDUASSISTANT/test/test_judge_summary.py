"""Public Judge summary must stay safe for unauthenticated viewers."""
import asyncio
import json
import os
import sys
import tempfile
import unittest
from unittest.mock import patch

BACKEND = os.path.join(os.path.dirname(__file__), '..', 'backend')
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

from app.routers import judge
from app.routers.judge import get_judge_summary


class JudgeSummaryTests(unittest.TestCase):
    def test_public_summary_has_only_safe_judge_metadata(self):
        with patch('app.routers.judge.get_one', return_value={'ok': 1}), \
                patch('app.routers.judge._holdout_summary', return_value={
                    'status': 'NOT_RUN', 'datasetVersion': None, 'datasetSha256': None,
                    'scenarioCount': None, 'timestamp': None, 'metrics': None,
                }):
            response = asyncio.run(get_judge_summary())
        body = __import__('json').loads(response.body)
        data = body['data']
        self.assertEqual(data['verifyHarness']['scenarioCount'], 9)
        self.assertFalse(data['verifyHarness']['networkCallsPerformed'])
        self.assertEqual(data['apiStatus'], 'AVAILABLE')
        self.assertEqual(data['databaseStatus'], 'AVAILABLE')
        self.assertNotIn('systemStatus', data)
        self.assertFalse(data['benchmark']['aiCallsPerformed'])
        self.assertEqual(data['adaptivePolicy']['currentThreshold'], data['adaptiveThreshold'])
        self.assertEqual(data['adaptivePolicy']['minThreshold'], 0.65)
        self.assertEqual(data['adaptivePolicy']['maxThreshold'], 0.9)
        self.assertEqual(data['adaptivePolicy']['step'], 0.02)
        self.assertEqual(data['frozenHoldout']['status'], 'NOT_RUN')
        self.assertNotIn('apiKey', str(data).lower())
        self.assertNotIn('token', str(data).lower())
        for forbidden in ('reviewername', 'reviewerid', 'feedback note', 'case pii'):
            self.assertNotIn(forbidden, str(data).lower())

    def test_database_failure_is_reported_without_connection_details(self):
        with patch('app.routers.judge.get_one', side_effect=RuntimeError('postgres://secret-host/db')):
            response = asyncio.run(get_judge_summary())
        data = __import__('json').loads(response.body)['data']
        self.assertEqual(data['databaseStatus'], 'UNAVAILABLE')
        self.assertNotIn('secret-host', str(data))
        self.assertNotIn('postgres://', str(data))

    def test_holdout_summary_shows_metrics_only_when_manifest_matches(self):
        with tempfile.TemporaryDirectory() as temp_root:
            holdout = os.path.join(temp_root, 'benchmark', 'holdout')
            results = os.path.join(holdout, 'results')
            os.makedirs(results)
            manifest = {
                'dataset': 'track_a_holdout_v1.json', 'version': '1.0',
                'frozen': True, 'scenarioCount': 36, 'sha256': 'a' * 64,
            }
            result = {
                'status': 'COMPLETED', 'dataset': manifest['dataset'],
                'datasetVersion': '1.0', 'datasetSha256': 'a' * 64,
                'scenarioCount': 36, 'timestamp': '2026-10-15T00:00:00Z',
                'decisionAccuracy': 91.67, 'automationRate': 25.0,
                'escalationRate': 75.0, 'missedEscalationRate': 0.0,
                'unnecessaryEscalationRate': 0.0, 'caseResults': ['must not be exposed'],
            }
            with open(os.path.join(holdout, 'manifest.json'), 'w', encoding='utf-8') as target:
                json.dump(manifest, target)
            with open(os.path.join(results, 'latest.json'), 'w', encoding='utf-8') as target:
                json.dump(result, target)
            with patch.object(judge, 'PROJECT_ROOT', temp_root):
                summary = judge._holdout_summary()

        self.assertEqual(summary['status'], 'COMPLETED')
        self.assertEqual(summary['datasetVersion'], '1.0')
        self.assertEqual(summary['datasetSha256'], 'a' * 64)
        self.assertEqual(summary['scenarioCount'], 36)
        self.assertEqual(summary['metrics']['decisionAccuracy'], 91.67)
        self.assertNotIn('caseResults', summary)

    def test_holdout_summary_rejects_a_result_with_the_wrong_digest(self):
        with tempfile.TemporaryDirectory() as temp_root:
            holdout = os.path.join(temp_root, 'benchmark', 'holdout')
            results = os.path.join(holdout, 'results')
            os.makedirs(results)
            manifest = {'dataset': 'track_a_holdout_v1.json', 'version': '1.0',
                        'frozen': True, 'scenarioCount': 36, 'sha256': 'a' * 64}
            result = {'status': 'COMPLETED', 'dataset': manifest['dataset'],
                      'datasetVersion': '1.0', 'datasetSha256': 'b' * 64,
                      'scenarioCount': 36}
            with open(os.path.join(holdout, 'manifest.json'), 'w', encoding='utf-8') as target:
                json.dump(manifest, target)
            with open(os.path.join(results, 'latest.json'), 'w', encoding='utf-8') as target:
                json.dump(result, target)
            with patch.object(judge, 'PROJECT_ROOT', temp_root):
                summary = judge._holdout_summary()

        self.assertEqual(summary['status'], 'INVALID')
        self.assertIsNone(summary['metrics'])

    def test_benchmark_run_returns_busy_response_when_another_run_holds_lock(self):
        judge._benchmark_lock.acquire()
        try:
            response = asyncio.run(judge.run_judge_benchmark())
        finally:
            judge._benchmark_lock.release()

        self.assertEqual(response.status_code, 409)
        body = json.loads(response.body)
        self.assertEqual(body['error'], 'BENCHMARK_ALREADY_RUNNING')


if __name__ == '__main__':
    unittest.main()
