"""Public, non-sensitive status data used by the unauthenticated judge page."""
import json
import os
import asyncio
import importlib.util
import threading

from fastapi import APIRouter

from app.core.responses import api_response
from app.services.escalation_policy_service import get_confidence_threshold
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
        'benchmarkType': 'GEMINI_ASSISTED_END_TO_END_BENCHMARK', 'aiCallsPerformed': False,
        'aiMode': None, 'aiProvider': None, 'aiModel': None, 'aiApiCalls': 0,
        'aiCasesProcessed': 0, 'fallbackCases': 0, 'aiFallbackReason': None,
        'totalCases': None, 'decisionAccuracy': None, 'automationRate': None,
        'escalationRate': None, 'missedEscalationRate': None,
        'unnecessaryEscalationRate': None,
        'benchmarkRunId': None, 'timestamp': None, 'executionTimeSec': None,
    }
    try:
        with open(result_path, 'r', encoding='utf-8') as source:
            data = json.load(source)
        metrics = data.get('metrics') or {}
        result = dict(default)
        result['benchmarkType'] = data.get('benchmarkType', default['benchmarkType'])
        result['aiCallsPerformed'] = data.get('aiCallsPerformed', False)
        for key in ('aiMode', 'aiProvider', 'aiModel', 'aiApiCalls', 'aiCasesProcessed', 'fallbackCases', 'aiFallbackReason'):
            result[key] = data.get(key, default[key])
        result['benchmarkRunId'] = data.get('benchmarkRunId')
        result['timestamp'] = data.get('timestamp')
        result['executionTimeSec'] = data.get('executionTimeSec')
        for key in metrics:
            if key in result:
                result[key] = metrics[key]
        return result
    except (OSError, ValueError, TypeError):
        return default


@router.get('/api/judge/summary')
async def get_judge_summary():
    """Return only public operational metadata; no credentials or user data."""
    gemini_configured = len(os.environ.get('GEMINI_API_KEY', '').strip()) > 10
    openrouter_configured = len(os.environ.get('OPENROUTER_API_KEY', '').strip()) > 10
    configured = gemini_configured or openrouter_configured
    return api_response(200, True, 'Public judge summary loaded.', {
        'systemStatus': 'AVAILABLE',
        'ai': {'configured': configured, 'status': 'CONFIGURED' if configured else 'NOT_CONFIGURED',
               'providers': {'gemini': gemini_configured, 'openrouter': openrouter_configured}},
        'adaptiveThreshold': get_confidence_threshold(),
        'benchmark': _benchmark_summary(),
        'verifyHarness': {'scenarioCount': len(HARNESS_CASES), 'type': 'DETERMINISTIC_RULE_ENGINE_VERIFICATION'},
    })


@router.post('/api/judge/benchmark/run')
async def run_judge_benchmark():
    """Run the fixed, synthetic 18-case benchmark on this deployed server."""
    try:
        result = await asyncio.to_thread(_run_benchmark_on_server)
        return api_response(200, True, 'Benchmark 18 tình huống đã chạy.', result)
    except Exception:
        return api_response(500, False, 'Không thể chạy benchmark trên máy chủ.', None, 'BENCHMARK_RUN_FAILED')
