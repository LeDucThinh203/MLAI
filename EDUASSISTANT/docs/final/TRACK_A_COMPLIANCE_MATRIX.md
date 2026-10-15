# Track A Final Compliance Matrix

## A. Operability

| Criterion | Repository evidence | Status |
| --- | --- | --- |
| Live URL | `https://edu-sp.pages.dev`; `/` returned HTTP 200 on 2026-10-15. | VERIFIED |
| Judge page | `/judge` returned HTTP 200. Current deployed summary returned `apiStatus=AVAILABLE` but `databaseStatus=UNKNOWN`; the updated local source queries PostgreSQL safely. | PARTIAL |
| Verify page and API | `/verify` returned HTTP 200; live `GET /api/verify/run` returned 9/9 with no network calls or database writes. | VERIFIED |
| Health | Live backend `GET /api/health` returned HTTP 200, `healthy`, and `postgresql: connected`. | VERIFIED |
| CI | `.github/workflows/ci.yml` separates backend unit, frontend, and PostgreSQL-backed competition readiness jobs. | PARTIAL until a post-change GitHub run completes |
| Runbook | `RUNBOOK.md` documents configuration, startup, demo accounts, Judge, and test commands. | PARTIAL |
| Demo accounts | Student, Reviewer, and Admin demo accounts are described as demo-only; production seeding is disabled. | PARTIAL |
| Deterministic Verify Harness | Nine in-memory cases; no network, AI, DB reads/writes, or threshold mutation. | VERIFIED by local run recorded in `EVALUATION_EVIDENCE.md` |

**Operability status: PARTIAL** because the deployed Judge summary still reports `databaseStatus=UNKNOWN` and no post-change GitHub Actions run was triggered. No deployment was made in this task.

## B. Real users

- Status: **PENDING**.
- No participants, feedback, quotes, scores, screenshots, or completed sessions are recorded in this task.
- Preparation package: [`docs/user-validation/`](../user-validation/).
- User Validation must remain PENDING until real sessions occur.

## C. Human-in-the-loop + Audit

| Criterion | Evidence | Status |
| --- | --- | --- |
| Reviewer queue and case details | `frontend/src/pages/reviewer/ReviewerPortal.jsx`; `backend/app/routers/cases.py`. | PARTIAL |
| APPROVE, REJECT, REQUEST_INFO, OVERRIDE, STOP | Reviewer actions pass through `workflow_guard`; override requires a reason. | PARTIAL pending PostgreSQL integration run |
| Reviewer feedback | `CORRECT`, `MISSED_ESCALATION`, and `UNNECESSARY_ESCALATION`; Student role is denied. | PARTIAL pending PostgreSQL integration run |
| Audit trail | Case, override, reviewer feedback, and stop events record actor, role, case reference, input, result, timestamp, and reason as applicable. | PARTIAL pending PostgreSQL integration run |
| Threshold history | PostgreSQL transaction locks policy state and writes old/new threshold, reviewer ID, event type, and timestamp. | PARTIAL pending PostgreSQL integration run |

**HITL + Audit status: PARTIAL** until the PostgreSQL competition integration job passes against its isolated database.

## D. Track A specific

| Criterion | Evidence | Status |
| --- | --- | --- |
| Adaptive confidence threshold | Default 0.75; bounds 0.65–0.90; step 0.02. Missed escalation raises it, unnecessary escalation lowers it, and correct feedback leaves it unchanged. | PARTIAL pending DB integration run |
| Reviewer feedback loop | Feedback updates threshold and creates case, audit, and threshold-history records. Student feedback is rejected. | PARTIAL pending DB integration run |
| Missed Escalation | Fixed benchmark reports count, expected-escalation denominator, and rate. | See verified run in `EVALUATION_EVIDENCE.md` |
| Unnecessary Escalation | Fixed benchmark reports count, expected-auto-approval denominator, and rate. | See verified run in `EVALUATION_EVIDENCE.md` |
| Deterministic benchmark | `benchmark/fixed_synthetic_cases.json` and `benchmark/run_benchmark.py`; label remains fixed synthetic. | VERIFIED by local run recorded in `EVALUATION_EVIDENCE.md` |
| Independent evaluation | Frozen external/independent cases and provenance required; `cases.json` is intentionally absent. | **PENDING** |

## Domain boundary

The only use case is `MILITARY_SERVICE_CONFIRMATION`, an internal student-status confirmation workflow supporting military-service paperwork. `AUTO_APPROVE` is an internal workflow outcome. EDUASSISTANT does not decide military-service deferment or exemption and does not issue a legal certificate.
