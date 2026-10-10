"""Public, non-sensitive status data used by the unauthenticated judge page."""
import json
import os

from fastapi import APIRouter

from app.core.responses import api_response
from app.services.escalation_policy_service import get_confidence_threshold
from app.services.verify_harness_service import HARNESS_CASES

router = APIRouter(tags=["Judge"])


def _benchmark_summary():
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    result_path = os.path.join(project_root, 'benchmark', 'results', 'latest.json')
    default = {
        'benchmarkType': 'DETERMINISTIC_DECISION_BENCHMARK', 'aiCallsPerformed': False,
        'totalCases': None, 'decisionAccuracy': None, 'automationRate': None,
        'escalationRate': None, 'missedEscalationRate': None,
        'unnecessaryEscalationRate': None,
    }
    try:
        with open(result_path, 'r', encoding='utf-8') as source:
            data = json.load(source)
        metrics = data.get('metrics') or {}
        result = dict(default)
        result['benchmarkType'] = data.get('benchmarkType', default['benchmarkType'])
        result['aiCallsPerformed'] = data.get('aiCallsPerformed', False)
        for key in metrics:
            if key in result:
                result[key] = metrics[key]
        return result
    except (OSError, ValueError, TypeError):
        return default


@router.get('/api/judge/summary')
async def get_judge_summary():
    """Return only public operational metadata; no credentials or user data."""
    configured = len(os.environ.get('GEMINI_API_KEY', '').strip()) > 10
    return api_response(200, True, 'Public judge summary loaded.', {
        'systemStatus': 'AVAILABLE',
        'ai': {'configured': configured, 'status': 'CONFIGURED' if configured else 'NOT_CONFIGURED', 'model': 'gemini-2.5-flash'},
        'adaptiveThreshold': get_confidence_threshold(),
        'benchmark': _benchmark_summary(),
        'verifyHarness': {'scenarioCount': len(HARNESS_CASES), 'type': 'DETERMINISTIC_RULE_ENGINE_VERIFICATION'},
    })
