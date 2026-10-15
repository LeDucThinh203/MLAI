"""Public, non-sensitive status data used by the unauthenticated judge page."""
import json
import os
import asyncio
import importlib.util
import threading

from fastapi import APIRouter

from app.core.responses import api_response
from app.db.database import get_one
from app.services.escalation_policy_service import get_public_policy_summary
from app.services.verify_harness_service import HARNESS_CASES

router = APIRouter(tags=["Judge"])
_benchmark_lock = threading.Lock()


def _run_benchmark_on_server():
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
    runner_path = os.path.join(project_root, 'benchmark', 'run_benchmark.py')
    spec = importlib.util.spec_from_file_location('eduassistant_benchmark_runner', runner_path)
    if spec is None or spec.loader is None:
        raise RuntimeError('Benchmark runner is unavailable.')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    with _benchmark_lock:
        return module.run_benchmark()


def _benchmark_summary():
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
    result_path = os.path.join(project_root, 'benchmark', 'results', 'latest.json')
    default = {
        'benchmarkType': 'DETERMINISTIC_TRACK_A_DECISION_BENCHMARK',
        'aiCallsPerformed': False,
        'evaluationTarget': 'ESCALATION_DECISION_POLICY',
        'scenarioCount': None,
        'totalCases': None, 'decisionAccuracy': None, 'automationRate': None,
        'escalationRate': None, 'missedEscalationRate': None,
        'unnecessaryEscalationRate': None,
        'correctCases': None, 'expectedEscalations': None,
        'missedEscalationCount': None, 'expectedAutoApprovals': None,
        'unnecessaryEscalationCount': None,
        'benchmarkRunId': None, 'timestamp': None, 'executionTimeSec': None,
    }
    try:
        with open(result_path, 'r', encoding='utf-8') as source:
            data = json.load(source)
        metrics = data.get('metrics') or {}
        result = dict(default)
        result['benchmarkType'] = data.get('benchmarkType', default['benchmarkType'])
        result['aiCallsPerformed'] = data.get('aiCallsPerformed', False)
        result['evaluationTarget'] = data.get('evaluationTarget', default['evaluationTarget'])
        result['scenarioCount'] = data.get('scenarioCount', metrics.get('totalCases'))
        result['benchmarkRunId'] = data.get('benchmarkRunId')
        result['timestamp'] = data.get('timestamp')
        result['executionTimeSec'] = data.get('executionTimeSec')
        for key in metrics:
            if key in result:
                result[key] = metrics[key]
        return result
    except (OSError, ValueError, TypeError):
        return default


def _independent_summary():
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
    result_path = os.path.join(project_root, 'benchmark', 'independent', 'results', 'latest.json')
    pending = {'status': 'PENDING', 'datasetId': None, 'metrics': None}
    try:
        with open(result_path, 'r', encoding='utf-8') as source:
            data = json.load(source)
        metrics = data.get('metrics') or {}
        allowed_metrics = (
            'totalCases', 'correctCases', 'decisionAccuracy', 'automationRate',
            'escalationRate', 'expectedEscalations', 'missedEscalationCount',
            'missedEscalationRate', 'expectedAutoApprovals',
            'unnecessaryEscalationCount', 'unnecessaryEscalationRate',
        )
        if data.get('status') != 'VERIFIED' or not data.get('datasetId'):
            return pending
        return {
            'status': 'VERIFIED',
            'datasetId': data['datasetId'],
            'metrics': {key: metrics[key] for key in allowed_metrics if key in metrics},
        }
    except (OSError, ValueError, TypeError):
        return pending


async def _database_status():
    try:
        return 'AVAILABLE' if await asyncio.to_thread(get_one, 'SELECT 1 AS ok') else 'UNAVAILABLE'
    except Exception:
        return 'UNAVAILABLE'


@router.get('/api/judge/summary')
async def get_judge_summary():
    """Return only public operational metadata; no credentials or user data."""
    gemini_configured = len(os.environ.get('GEMINI_API_KEY', '').strip()) > 10
    openrouter_configured = len(os.environ.get('OPENROUTER_API_KEY', '').strip()) > 10
    configured = gemini_configured or openrouter_configured
    adaptive_policy = await asyncio.to_thread(get_public_policy_summary)
    return api_response(200, True, 'Public judge summary loaded.', {
        'apiStatus': 'AVAILABLE',
        'databaseStatus': await _database_status(),
        'ai': {'configured': configured, 'status': 'CONFIGURED' if configured else 'NOT_CONFIGURED',
               'providers': {'gemini': gemini_configured, 'openrouter': openrouter_configured}},
        'adaptiveThreshold': adaptive_policy['currentThreshold'],
        'adaptivePolicy': adaptive_policy,
        'benchmark': _benchmark_summary(),
        'independentEvaluation': _independent_summary(),
        'verifyHarness': {
            'scenarioCount': len(HARNESS_CASES),
            'type': 'DETERMINISTIC_RULE_ENGINE_VERIFICATION',
            'networkCallsPerformed': False,
            'databaseWritesPerformed': False,
        },
    })


@router.post('/api/judge/benchmark/run')
async def run_judge_benchmark():
    """Run the fixed, synthetic 18-case benchmark on this deployed server."""
    try:
        result = await asyncio.to_thread(_run_benchmark_on_server)
        return api_response(200, True, 'Benchmark 18 tình huống đã chạy.', result)
    except Exception:
        return api_response(500, False, 'Không thể chạy benchmark trên máy chủ.', None, 'BENCHMARK_RUN_FAILED')
