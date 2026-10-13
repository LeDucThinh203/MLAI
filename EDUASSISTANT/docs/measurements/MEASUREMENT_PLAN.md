# Measurement Plan

## Evaluation paths

### Track A Decision Benchmark

`benchmark/run_benchmark.py` evaluates the escalation decision policy on 18 fixed synthetic scenarios from `benchmark/held_out_cases.json`. It uses address-analysis, AI provenance, institutional facts, and student-claim fixtures. It calls no AI provider, uses no network or database, and writes only local result artifacts.

Metadata must report:

- `benchmarkType`: `DETERMINISTIC_TRACK_A_DECISION_BENCHMARK`
- `aiCallsPerformed`: `false`
- `evaluationTarget`: `ESCALATION_DECISION_POLICY`
- `scenarioCount`: the loaded scenario count

Metrics:

- `decisionAccuracy = correctCases / totalCases`
- `automationRate = AUTO_APPROVE decisions / totalCases`
- `escalationRate = ESCALATE_TO_HUMAN decisions / totalCases`
- `missedEscalationRate = expected escalations incorrectly auto-approved / expected escalations`
- `unnecessaryEscalationRate = expected auto-approvals incorrectly escalated / expected auto-approvals`

The scenario set is fixed for reproducibility. It is not claimed to be independent or held out from development. The generated latest result is in `benchmark/results/latest.json` and `latest.csv`.

### Verify Harness

`POST /api/verify/run` executes 9 deterministic Rule Engine cases. It performs no network calls, database access or writes, global AI-mode mutation, or adaptive-threshold mutation. Each result includes expected and actual decisions/reasons, matched rule, pass state, and duration. The run includes a total duration.

### Optional Live AI E2E Sanity Check

`benchmark/run_live_ai_eval.py` checks five representative address inputs through the current address service. It reports actual provider/model, API attempts, latency, parsed fields, confidence score, fallback state, and Rule Engine result. Gemini is tried first; OpenRouter can run as fallback when configured. Deterministic parser output is recorded as fallback; it is not reported as a successful live AI call. This evaluation does not contribute to Track metrics.

## Current result

Run `python benchmark/run_benchmark.py` to regenerate the metrics. Update this section and README from the resulting artifact; do not edit expected fixture decisions to improve the score.

## Interpretation limits

These measurements describe policy behavior on the fixed synthetic scenario set. They do not establish production accuracy, statistical calibration, external SIS connectivity, user validation, or legal eligibility decisions. User validation remains **PENDING** until real evidence is recorded.
