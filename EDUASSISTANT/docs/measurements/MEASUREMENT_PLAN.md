# Measurement Plan

Report each evaluation path separately. Never merge synthetic, independent, live-AI, or participant evidence into one score.

## A. Verify Harness — 9 deterministic functional cases

`POST /api/verify/run` evaluates nine in-memory Rule Engine scenarios. It makes no AI or network calls, performs no database reads or writes, and does not mutate the adaptive threshold. The Judge page runs it with one click. It checks normal processing, format invariance, missing facts, temporary address, material address conflict, academic authority, out-of-scope policy, and ownership mismatch.

The result includes run ID, timestamp, total duration, expected and actual decisions and reasons, matched rule, and per-case pass state. This is functional verification, not a model-accuracy estimate.

## B. Fixed Synthetic Benchmark — 18 fixed scenarios

`benchmark/run_benchmark.py` evaluates the fixed cases in `benchmark/fixed_synthetic_cases.json`. It calls no AI provider, makes no network or database calls, and writes the run to `benchmark/results/latest.json` and `latest.csv`.

Every rate is a percentage from 0 to 100. Report raw numerator and denominator beside the rate.

- `decisionAccuracy = correctCases / totalCases * 100`
- `automationRate = AUTO_APPROVE decisions / totalCases * 100`
- `escalationRate = ESCALATE_TO_HUMAN decisions / totalCases * 100`
- `missedEscalationRate = missedEscalationCount / expectedEscalations * 100`
- `unnecessaryEscalationRate = unnecessaryEscalationCount / expectedAutoApprovals * 100`

`expectedEscalations` counts all cases whose expected decision is `ESCALATE_TO_HUMAN`. `missedEscalationCount` counts those cases actually routed to `AUTO_APPROVE`.

`expectedAutoApprovals` counts all cases whose expected decision is `AUTO_APPROVE`. `unnecessaryEscalationCount` counts those cases actually routed to `ESCALATE_TO_HUMAN`.

The benchmark is a **fixed synthetic benchmark**. It is not independent, held out, production accuracy, or evidence of legal eligibility.

## C. Independent Evaluation — PENDING

Status remains **PENDING** until an independently created dataset with pre-agreed expected decisions, provenance, and a freeze timestamp is supplied. The dataset must not copy Verify Harness or fixed benchmark cases, and the development team must not tune on it. `benchmark/independent/run_independent_eval.py` exits successfully with `INDEPENDENT_EVALUATION_PENDING` when `cases.json` is absent; `--require-data` is available for a release gate. No result artifact is created while pending.

## D. Live AI sanity check — separate, not a Track A metric

`benchmark/run_live_ai_eval.py` calls configured live AI providers for address extraction and reports provider, model, fallback, attempts, and output. It can incur provider usage and depends on network and secrets. Its result does not measure Track A routing accuracy and is not part of ordinary CI.

## E. User Validation — PENDING

Status remains **PENDING** until real participants complete sessions. The canonical plan and blank forms are in `docs/user-validation/`. Do not create synthetic participants, feedback, quotations, scores, or completion claims.

## Current results

Read the latest fixed benchmark artifact at `benchmark/results/latest.json`; it contains the run ID, timestamp, raw counts, denominators, and rates. The current repository task does not include independent data or completed user validation.
