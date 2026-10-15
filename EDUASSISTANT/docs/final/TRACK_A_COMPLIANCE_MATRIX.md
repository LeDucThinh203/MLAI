# Track A Final Compliance Matrix

## A. Operability

| Criterion | Evidence | Status |
| --- | --- | --- |
| Live URL | `https://edu-sp.pages.dev`; `/`, `/judge`, and `/verify` returned HTTP 200 in read-only checks on 2026-10-15. | VERIFIED live at check time |
| Judge and database visibility | Local Judge source reports database availability safely and separates Verify, the 18-case development benchmark, and the frozen holdout. Live Judge still serves the earlier deployed version; its summary reported `databaseStatus=AVAILABLE` but has no `frozenHoldout` field. | Local change NOT DEPLOYED; live API VERIFIED at check time |
| Verify page and API | Live `/verify` returned HTTP 200; live `GET /api/verify/run` returned 9/9 without network calls or database writes. | VERIFIED live at check time; local rerun NOT RUN |
| Health | Live `GET /api/health` returned HTTP 200, healthy, with PostgreSQL connected. | VERIFIED live at check time |
| CI | Baseline `3f80e484e8c1c4da6d720b983ffac019258b8c25`: GitHub Actions run [38683292907](https://github.com/LeDucThinh203/MLAI/actions/runs/38683292907) had backend-unit and frontend PASS; competition-readiness FAILED at `test/test_competition_features.py`. Local fixes are uncommitted and have no rerun. | BASELINE FAILED; LOCAL DIFF NOT VERIFIED |
| Runbook | `EDUASSISTANT/RUNBOOK.md` is canonical; `EDUASSISTANT/docs/runbook/RUNBOOK.md` points to it. | DOCUMENTED; commands NOT RUN this turn |
| Demo accounts | Documentation describes demo-only roles and disables production demo SIS by default. Production logins were not tested. | DOCUMENTED; login NOT VERIFIED |
| Deterministic Verify Harness | Nine deterministic in-memory cases are documented as isolated from AI, network, database writes, and threshold changes. | Prior local run recorded; current rerun NOT RUN |

## B. Real users

- Status: **PENDING**.
- No participants, feedback, quotes, scores, screenshots, or completed sessions are recorded for this task.
- Preparation package: [`docs/user-validation/`](../user-validation/).
- Keep User Validation pending until real sessions occur.

## C. Human-in-the-loop and audit

| Criterion | Evidence | Status |
| --- | --- | --- |
| Reviewer queue and case details | Reviewer portal and case router. | Source present; current PostgreSQL integration NOT RUN |
| APPROVE, REJECT, REQUEST_INFO, OVERRIDE, STOP | Reviewer actions pass through the workflow guard; override requires a reason. | Source present; current PostgreSQL integration NOT RUN |
| Reviewer feedback | `CORRECT`, `MISSED_ESCALATION`, and `UNNECESSARY_ESCALATION`; Student role is denied. | Source present; current PostgreSQL integration NOT RUN |
| Audit trail | Case, override, feedback, and stop events record applicable actor, role, case, input, result, time, and reason. | Source present; current PostgreSQL integration NOT RUN |
| Threshold history | PostgreSQL transaction locks policy state and records threshold changes and reviewer metadata. | Source present; current PostgreSQL integration NOT RUN |

**HITL and audit status:** source is present; regression assertions have been expanded, but integration behavior on this working tree is NOT VERIFIED because the PostgreSQL suite was not run.

## D. Track A evidence

| Criterion | Evidence | Status |
| --- | --- | --- |
| Rule Engine and five escalation reasons | Deterministic routing retains `OWNERSHIP_UNCLEAR`, `FACT_UNKNOWN`, `DATA_CONFLICT`, `AUTHORITY_REQUIRED`, and `POLICY_OUT_OF_SCOPE`. | Source present; current tests NOT RUN |
| Adaptive threshold | Default 0.75; bounds 0.65–0.90; step 0.02; feedback-driven updates are handled by the escalation policy service. | Source present; PostgreSQL integration NOT RUN |
| Reviewer feedback loop and workflow guard | Feedback and reviewer actions use guarded routes and audit/history persistence. | Source present; PostgreSQL integration NOT RUN |
| Fixed Synthetic Development Benchmark | 18 fixed synthetic scenarios with exact denominators and dataset SHA-256 provenance. | Historical result: 18/18; current rerun NOT RUN |
| Frozen Holdout | Static 36-case v1 dataset with explicit expected labels, manifest, and exact SHA-256; separate manual runner verifies bytes before evaluation. No result artifact exists. | FROZEN; **NOT RUN** |
| Runtime, CI, and unit-test separation | Holdout data is not imported by application runtime, routine CI, or tests; tests use temporary fixtures. | Source/configuration present; current test run NOT RUN |

## Domain boundary

The only use case is `MILITARY_SERVICE_CONFIRMATION`, an internal student-status confirmation workflow supporting military-service paperwork. `AUTO_APPROVE` is an internal workflow outcome. EDUASSISTANT does not decide military-service deferment or exemption and does not issue a legal certificate. User Validation remains pending.

## Current readiness

**NOT READY.** Baseline competition-readiness CI failed; local fixes have not been executed or rerun in CI. Verify, benchmark, frontend, PostgreSQL integration, and final preflight remain unverified on this worktree. The frozen holdout remains **NOT RUN** and User Validation remains **PENDING**.
