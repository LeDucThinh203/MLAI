# Evaluation Evidence

## Revision and CI status

- Reviewed baseline and current local `HEAD`: `3f80e484e8c1c4da6d720b983ffac019258b8c25` (`docs: align Track A submission evidence`). The worktree is based on this commit; the changes listed below are uncommitted.
- GitHub Actions run [38683292907](https://github.com/LeDucThinh203/MLAI/actions/runs/38683292907), created 2026-10-15 04:47 UTC for that baseline, completed with **failure**. `backend-unit` and `frontend` passed; `competition-readiness` failed at `python test/test_competition_features.py`.
- Source review confirmed two defects addressed in the local diff: case-creation test parsing assumed HTTP 200 although `POST /api/cases` returns 201, and the direct psycopg row lookup did not quote the `currentThreshold` alias. Local fixes and expanded regression assertions have not been rerun. This work has not been pushed, so there is no CI result for the changed files.
- No push, deployment, history rewrite, or production database operation was performed.
- User Validation remains **PENDING**. No participants, quotations, scores, screenshots, or feedback improvements were fabricated.

## Checks on the current worktree

Python, Node.js, npm, and GitHub CLI are not available in the local shell. An earlier attempt to prepare official runtimes was rejected by the execution policy; no runtime was installed. The following checks are **NOT RUN** on the current source changes:

The CI critical pytest command, competition script, Verify command, development benchmark, final preflight, and frontend lint/build commands were attempted; PowerShell returned “command not recognized” for `python` or `npm` before any project code ran.

- Critical backend unit tests and the new PostgreSQL-row regression tests
- PostgreSQL competition integration suite
- Verify Harness
- Fixed Synthetic Development Benchmark rerun
- Frontend install, lint, and build
- `scripts/final_preflight.py`
- Frozen Holdout evaluation

The unit-style transaction test uses a psycopg `dict_row`-shaped row and verifies the quoted alias, retained `FOR UPDATE`, feedback transitions, missing-row failure, and rollback on history-insert failure. It still needs execution. The competition suite uses the disposable PostgreSQL 16 CI service configured in `.github/workflows/ci.yml`; it has not run for this local diff.

## Historical backend and development evidence

An earlier local run, before this working tree, reported `138 passed, 9 subtests passed`; Verify Harness reported 9/9 with zero network calls and zero database writes. Those are historical results, not reruns of the current source.

The most recent recorded development benchmark artifact is `benchmark/results/latest.json` and `latest.csv`:

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

The fixed development dataset SHA-256 is `7a54df274f46e0ea3fa3d18b1f371f1826898897d6f95ef900fa55e13da1af58`. The recorded result predates the current worktree and is not a current rerun. It is synthetic development evidence, not production accuracy or user validation.

## Frozen Holdout

- Dataset: `benchmark/holdout/track_a_holdout_v1.json`
- Version: `1.0`
- Scenario count: `36`
- Frozen SHA-256, verified against the file on 2026-10-15: `b357bf066791b0c92ad0ee8362111a5cd865660a9e43eab5f627bca47d4b556a`
- Status: **NOT RUN**; no result artifact exists.
- The manifest says the dataset is not used by runtime, training, or unit tests. It was authored for this repository; no external or independent authorship is claimed. Do not tune on v1 or change its labels after evaluation.

The frozen evaluation was not run because the required preceding checks and code freeze have not been completed.

## Frontend, operation, and scope

- An earlier local run recorded `npm ci`, lint, and build as passing; Vite emitted a bundle-size warning. These checks have not been rerun on this source revision.
- Prior read-only live checks on 2026-10-15 around 04:40 UTC observed HTTP 200 for the deployed frontend (`/`, `/judge`, `/verify`) and backend health/Judge endpoints; the deployed Judge reported 18-case metrics and no frozen holdout result. These observations describe the then-deployed revision, not this unpushed local source.
- Production demo logins were not tested. No current deployment was performed or verified.
- The product is an internal student-status confirmation workflow. `AUTO_APPROVE` is an internal workflow outcome; it does not determine military-service deferment or exemption and does not issue a legal certificate.

## User Validation

**PENDING.** Real participant sessions have not been conducted for this task.
