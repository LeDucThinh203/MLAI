# Evaluation Evidence

## Revision and scope

- Original reviewed baseline: `0d4286c9c713ff9e575d7aa571a359cc25902305`.
- Current local `HEAD`: `b5519b21b98475a3cce8cea658934e37f62c1567`.
- The current working tree contains uncommitted holdout, Judge, preflight, CI,
  and documentation changes. No push or deployment was made for this work.
- User Validation remains **PENDING**. No participants, quotations, scores,
  screenshots, or user-feedback improvements were fabricated.

## Current working-tree checks

The current local tool environment does not provide Python, Node.js, or npm.
An attempt to prepare temporary official runtimes outside the repository was
rejected by the execution policy (`blocked by policy`). No runtime was
installed. Therefore the commands below were **not re-run on this working tree**:

- Critical backend pytest suite
- Verify Harness
- Fixed Synthetic Development Benchmark
- Frozen Holdout evaluation
- Frontend `npm ci`, lint, and build
- `python scripts/final_preflight.py`
- PostgreSQL competition integration suite

The PostgreSQL integration job is configured in `.github/workflows/ci.yml`
with a disposable PostgreSQL 16 service. It has not run against this unpushed
working tree. Remote CI status on the final local changes is **NOT VERIFIED**.

## Last recorded backend results — earlier local run

Before the current holdout and preflight changes, the recorded critical suite
reported `138 passed, 9 subtests passed`; Verify Harness reported `9/9`, zero
network calls, and zero database writes. Those results describe the earlier
working tree and are not a rerun of the current changes.

## Last recorded development benchmark — earlier local run

Artifact: `benchmark/results/latest.json` and `latest.csv`.

```text
timestamp: 2026-10-15T03:56:08.084643Z
scenarioCount: 18
correctCases: 18
decisionAccuracy: 100.0% (18/18)
automationRate: 27.78% (5/18)
escalationRate: 72.22% (13/18)
expectedEscalations: 13
missedEscalationRate: 0.0% (0/13)
expectedAutoApprovals: 5
unnecessaryEscalationRate: 0.0% (0/5)
aiCallsPerformed: false
```

This is fixed synthetic development evidence, not production accuracy or user
validation. The dataset file is unchanged from that run. Its exact SHA-256 is
`7a54df274f46e0ea3fa3d18b1f371f1826898897d6f95ef900fa55e13da1af58`; this
digest and explicit caseResults alias were added to the existing JSON artifact
after verifying the unchanged dataset bytes. The metrics and timestamp were
not regenerated. The benchmark was **not re-run** after adding automatic
SHA-256 recording to the runner.

## Frozen Holdout

- Dataset: `benchmark/holdout/track_a_holdout_v1.json`
- Version: `1.0`
- Scenario count: `36`
- Frozen SHA-256: `b357bf066791b0c92ad0ee8362111a5cd865660a9e43eab5f627bca47d4b556a`
- Status: **NOT RUN** on this working tree; no result artifact exists.
- The manifest states the dataset is not used by runtime, training, or unit
  tests. It was authored for this repository and is not claimed as externally
  or independently authored. Do not tune on v1 or change its labels after
  evaluation.

## Frontend and operation

- The earlier run recorded `npm ci`, lint, and build as passing; Vite emitted a
  bundle-size warning. These checks have not been rerun after the current Judge
  UI changes.
- PostgreSQL integration was not run locally because no local PostgreSQL,
  `psql`, or Docker was available in the recorded environment.
- Live URLs and API health are read-only deployment observations. They do not
  prove that the unpushed local Judge changes are deployed.

Read-only live checks on 2026-10-15 at approximately 04:40 UTC:

| Endpoint | Observed result |
| --- | --- |
| `https://edu-sp.pages.dev/` | HTTP 200 |
| `https://edu-sp.pages.dev/judge` | HTTP 200 |
| `https://edu-sp.pages.dev/verify` | HTTP 200 |
| `https://mlai-qdu7.onrender.com/api/health` | HTTP 200; healthy; PostgreSQL connected |
| `https://mlai-qdu7.onrender.com/api/judge/summary` | HTTP 200; `apiStatus=AVAILABLE`; `databaseStatus=AVAILABLE`; 18-case metrics present |
| `https://mlai-qdu7.onrender.com/api/verify/run` (GET) | HTTP 200; 9/9; no network calls or database writes |

The live API does not yet report `frozenHoldout`; the local changes are not
deployed. Demo login accounts were not tested against production.

## User Validation

**PENDING.** Real participant sessions have not been conducted for this task.
