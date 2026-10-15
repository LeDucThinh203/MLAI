# Evaluation Evidence

## Revision and CI status

- Code revision evaluated: `a6bf9076e8b6de471f42e936f7991991ab7cf3de` (`test: compare threshold steps with float tolerance`), pushed to `main`.
- GitHub Actions run [38686079502](https://github.com/LeDucThinh203/MLAI/actions/runs/38686079502) completed successfully for this revision. `backend-unit`, `competition-readiness`, and `frontend` all passed.
- `backend-unit` reported 142 passed and 9 subtests passed. The competition job passed the PostgreSQL integration suite, Verify Harness assertions, 18-case development benchmark, and benchmark provenance check. The frontend lint/build job passed.
- The successful Verify Harness assertion reported 9 total, 0 failed, no network calls, and no database writes. The benchmark provenance assertion confirmed 18 results and the exact development dataset SHA-256 recorded below.
- This checkout has no Python, Node.js, or npm runtime, so local test, lint, build, and preflight commands were **NOT RUN**. GitHub Actions executed the code checks listed above. The separate `scripts/final_preflight.py` command was not run.
- No deployment or production database operation was part of this push. User Validation remains **PENDING**; no participant results or feedback improvements are claimed.

## CI development benchmark

The successful CI run generated and checked the fixed synthetic development benchmark:

```text
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
datasetSha256: 7a54df274f46e0ea3fa3d18b1f371f1826898897d6f95ef900fa55e13da1af58
```

These are results on a fixed synthetic development set, not production accuracy or user validation. The workload comparison with manual review of all 18 cases is a synthetic reference only, not measured production impact.

## Frozen Holdout

- Dataset: `benchmark/holdout/track_a_holdout_v1.json`
- Version: `1.0`
- Scenario count: `36`
- Frozen SHA-256: `b357bf066791b0c92ad0ee8362111a5cd865660a9e43eab5f627bca47d4b556a`
- Status: **NOT RUN**; no result artifact exists.
- The manifest says this dataset is not used by runtime, training, or unit tests. It was authored for this repository; no external or independent authorship is claimed. Keep v1 labels unchanged after evaluation.

## Frontend, operation, and scope

- The frontend lint and build passed in the successful CI run above.
- Read-only live checks on 2026-10-15 around 04:40 UTC observed HTTP 200 for the deployed frontend (`/`, `/judge`, `/verify`) and backend health/Judge endpoints. Those observations describe the deployed revision at that time; this push did not deploy the current source revision.
- Production demo logins were not tested. No deployment was performed or verified as part of this task.
- The product is an internal student-status confirmation workflow. `AUTO_APPROVE` is an internal workflow outcome; it does not determine military-service deferment or exemption and does not issue a legal certificate.

## User Validation

**PENDING.** Real participant sessions have not been conducted for this task.
