# Track A Final Compliance Matrix

## A. Operability

| Criterion | Evidence | Status |
| --- | --- | --- |
| Live URL | `https://edu-sp.pages.dev`; `/`, `/judge`, and `/verify` returned HTTP 200 in read-only checks on 2026-10-15. | VERIFIED at check time; current source not deployed |
| Judge and database visibility | Current source reports database availability safely and separates Verify, development benchmark, and frozen holdout status. The live Judge observation was from the earlier deployed version. | Source CI-VERIFIED; current source NOT DEPLOYED |
| Verify page and API | CI asserted 9/9 with no network calls or database writes. Earlier read-only live `/verify` and API checks returned HTTP 200. | CI-VERIFIED; live check is from earlier deployed version |
| Health | Live `GET /api/health` returned HTTP 200, healthy, with PostgreSQL connected in the read-only check on 2026-10-15. | VERIFIED at check time |
| CI | Code revision `a6bf9076e8b6de471f42e936f7991991ab7cf3de`: GitHub Actions run [38686079502](https://github.com/LeDucThinh203/MLAI/actions/runs/38686079502) passed `backend-unit`, `competition-readiness`, and `frontend`. | PASS for tested code revision |
| Runbook | `EDUASSISTANT/RUNBOOK.md` is canonical; `EDUASSISTANT/docs/runbook/RUNBOOK.md` points to it. | DOCUMENTED |
| Demo accounts | Documentation describes demo-only roles and disables production demo SIS by default. Production logins were not tested. | DOCUMENTED; login NOT VERIFIED |
| Deterministic Verify Harness | Successful CI run asserted 9 total, 0 failed, no network calls, and no database writes. | CI-VERIFIED; local rerun NOT RUN |

## B. Real users

- Status: **PENDING**.
- No participants, feedback, quotes, scores, screenshots, or completed sessions are recorded for this task.
- Preparation package: [`docs/user-validation/`](../user-validation/).
- Keep User Validation pending until real sessions occur.

## C. Human-in-the-loop and audit

| Criterion | Evidence | Status |
| --- | --- | --- |
| Reviewer queue and case details | Reviewer portal, case router, and PostgreSQL-backed integration coverage. | CI integration PASS |
| APPROVE, REJECT, REQUEST_INFO, OVERRIDE, STOP | Reviewer actions pass through the workflow guard; override requires a reason. | CI integration PASS |
| Reviewer feedback | `CORRECT`, `MISSED_ESCALATION`, and `UNNECESSARY_ESCALATION`; Student role is denied. | CI integration PASS |
| Audit trail | Case, override, feedback, and stop events record applicable actor, role, case, input, result, time, and reason. | CI integration PASS |
| Threshold history | PostgreSQL transaction locks policy state and records threshold changes and reviewer metadata. | CI integration PASS |

**HITL and audit status:** the PostgreSQL-backed competition-readiness suite passed in CI run [38686079502](https://github.com/LeDucThinh203/MLAI/actions/runs/38686079502). Local integration commands were not run because the local Python runtime is unavailable.

## D. Track A evidence

| Criterion | Evidence | Status |
| --- | --- | --- |
| Rule Engine and five escalation reasons | Deterministic routing retains `OWNERSHIP_UNCLEAR`, `FACT_UNKNOWN`, `DATA_CONFLICT`, `AUTHORITY_REQUIRED`, and `POLICY_OUT_OF_SCOPE`. | Backend and competition CI PASS |
| Adaptive threshold | Default 0.75; bounds 0.65–0.90; step 0.02; feedback-driven updates are handled by the escalation policy service. | PostgreSQL integration CI PASS |
| Reviewer feedback loop and workflow guard | Feedback and reviewer actions use guarded routes and audit/history persistence. | Competition integration CI PASS |
| Fixed Synthetic Development Benchmark | 18 fixed synthetic scenarios; 100.0% decision accuracy (18/18), 27.78% automation (5/18), 72.22% escalation (13/18); dataset SHA-256 provenance checked. | CI PASS; synthetic development evidence only |
| Frozen Holdout | Static 36-case v1 dataset with explicit expected labels, manifest, and exact SHA-256; separate manual runner verifies bytes before evaluation. No result artifact exists. | FROZEN; **NOT RUN** |
| Runtime, CI, and unit-test separation | Holdout data is not imported by application runtime; routine CI uses separate test fixtures. | Source/configuration present; standard CI PASS; holdout NOT RUN |

## Domain boundary

The only use case is `MILITARY_SERVICE_CONFIRMATION`, an internal student-status confirmation workflow supporting military-service paperwork. `AUTO_APPROVE` is an internal workflow outcome. EDUASSISTANT does not decide military-service deferment or exemption and does not issue a legal certificate. User Validation remains pending.

## Current readiness

**NOT READY.** CI is green for the tested code revision, including Verify, benchmark, frontend, and PostgreSQL integration. The separate local final preflight was not run. Frozen Holdout remains **NOT RUN** and User Validation remains **PENDING**, so full Track A readiness is not established.
