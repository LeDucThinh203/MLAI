"""Public Judge summary must stay safe for unauthenticated viewers."""
import asyncio
import os
import sys
import unittest
from unittest.mock import patch

BACKEND = os.path.join(os.path.dirname(__file__), '..', 'backend')
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

from app.routers.judge import get_judge_summary


class JudgeSummaryTests(unittest.TestCase):
    def test_public_summary_has_only_safe_judge_metadata(self):
        with patch('app.routers.judge.get_one', return_value={'ok': 1}):
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
        self.assertEqual(data['independentEvaluation']['status'], 'PENDING')
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


if __name__ == '__main__':
    unittest.main()
