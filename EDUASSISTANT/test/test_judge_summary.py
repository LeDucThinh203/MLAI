"""Public Judge summary must stay safe for unauthenticated viewers."""
import asyncio
import os
import sys
import unittest

BACKEND = os.path.join(os.path.dirname(__file__), '..', 'backend')
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

from app.routers.judge import get_judge_summary


class JudgeSummaryTests(unittest.TestCase):
    def test_public_summary_has_only_safe_judge_metadata(self):
        response = asyncio.run(get_judge_summary())
        body = __import__('json').loads(response.body)
        data = body['data']
        self.assertEqual(data['verifyHarness']['scenarioCount'], 9)
        self.assertFalse(data['benchmark']['aiCallsPerformed'])
        self.assertNotIn('apiKey', str(data).lower())
        self.assertNotIn('token', str(data).lower())


if __name__ == '__main__':
    unittest.main()
