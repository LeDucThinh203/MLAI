# Evaluation Evidence

## Source and run context

- Baseline Git commit: `0d4286c9c713ff9e575d7aa571a359cc25902305` (`feat(agent): improve chat response readability`).
- Evaluation was run against the local working tree based on this baseline. The later commits and push do not include a deployment.
- Commands were run locally on 2026-10-15. Generated benchmark artifact timestamp: `2026-10-15T03:56:08.084643Z`.
- Python 3.11.9 and Node.js 22.23.3 were installed under the temporary directory, outside the repository.

## Backend unit tests

The curated suite, including `test_agent_attachment.py` and the new adaptive-policy and independent-evaluation tests, completed with:

```text
138 passed, 9 subtests passed
```

## Verify Harness

Observed run ID: `VRF-1792036567-9047`; timestamp: `2026-10-15T03:56:07.162643Z`; duration: 8.52 ms.

```text
total: 9
passed: 9
failed: 0
networkCallsPerformed: false
databaseCallsPerformed: false
databaseWritesPerformed: false
aiCallsPerformed: false
```

## Fixed synthetic benchmark

Artifact: `benchmark/results/latest.json` and `benchmark/results/latest.csv`.

```text
scenarioCount: 18
totalCases: 18
correctCases: 18
decisionAccuracy: 100.0%
automationRate: 27.78% (5/18)
escalationRate: 72.22% (13/18)
expectedEscalations: 13
missedEscalationCount: 0
missedEscalationRate: 0.0% (0/13)
expectedAutoApprovals: 5
unnecessaryEscalationCount: 0
unnecessaryEscalationRate: 0.0% (0/5)
aiCallsPerformed: false
```

This is a fixed synthetic decision benchmark, not an independent, held-out, or production-accuracy evaluation.

## Independent evaluation

- Status: **PENDING**.
- `benchmark/independent/cases.json` is absent; no independent dataset or results were fabricated.
- `python benchmark/independent/run_independent_eval.py` printed `INDEPENDENT_EVALUATION_PENDING` and exited 0 in its non-required-data mode.
- No `benchmark/independent/results/latest.json` or `.csv` was generated.

## Frontend

- `npm ci`: passed; npm reported zero vulnerabilities.
- `npm run lint`: passed.
- `npm run build`: passed. Vite reported a bundle-size warning because the minified JavaScript chunk is larger than 500 kB.

## Competition integration and CI

- Competition integration: **NOT RUN locally**. No local PostgreSQL server, `psql`, or Docker executable is available. The separate CI job is configured to use an isolated PostgreSQL 16 service database.
- The local backend unit suite and frontend checks above passed. Check the GitHub Actions run for results from the pushed commits; these local results do not stand in for remote CI.

## Read-only live deployment checks

Checked on 2026-10-15. These requests observed the existing deployment; no deployment or production change was made.

| URL | Result |
| --- | --- |
| `https://edu-sp.pages.dev/` | HTTP 200 |
| `https://edu-sp.pages.dev/judge` | HTTP 200 |
| `https://edu-sp.pages.dev/verify` | HTTP 200 |
| `https://mlai-qdu7.onrender.com/api/health` | HTTP 200; `healthy`; PostgreSQL connected; AI mode live |
| `https://mlai-qdu7.onrender.com/api/judge/summary` | HTTP 200; `apiStatus=AVAILABLE`; deployed `databaseStatus=UNKNOWN` |
| `https://mlai-qdu7.onrender.com/api/verify/run` (GET) | HTTP 200; 9/9 passed; no network calls or database writes |

The deployed Judge API is still on an older version: it reports `databaseStatus=UNKNOWN` and does not include the independent-evaluation field. The local source changes fix the summary, but are not deployed.

## Real user validation

**PENDING.** No participants, sessions, quotes, scores, screenshots, or feedback results were created for this work.
