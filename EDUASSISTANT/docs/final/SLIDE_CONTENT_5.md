# Five-Slide Submission Content

This file contains slide content only. It is not a PowerPoint deck.

## Slide 1 — Problem and workflow pain

- Students request student-status confirmation for military-service paperwork.
- Missing, ambiguous, or conflicting facts create repeated manual checks.
- EDUASSISTANT aims to route uncertain requests to a human reviewer.
- The system supports an internal workflow; it does not decide legal deferment.

## Slide 2 — Input → processing → output → human

- **Input:** student claim and trusted institutional facts.
- **AI support:** address analysis, permitted attachment OCR, and student guidance.
- **Routing authority:** deterministic Rule Engine checks identity, provenance,
  academic facts, address completeness, conflicts, and confidence.
- **Output:** internal `AUTO_APPROVE` or `ESCALATE_TO_HUMAN`.
- **Human:** Reviewer handles escalations, records feedback, and leaves an
  auditable decision.

## Slide 3 — Impact and measurement

- Last recorded 18-case development benchmark (2026-10-15 03:56:08 UTC):
  Decision Accuracy **100.0% (18/18)**; Automation Rate **27.78% (5/18)**;
  Escalation Rate **72.22% (13/18)**; Missed Escalation **0.0% (0/13)**;
  Unnecessary Escalation **0.0% (0/5)**; AI calls **0**.
- Label those as a prior fixed synthetic development run; it has not been
  rerun on the current working tree. Frozen Holdout result: **NOT RUN**.
- Show a before/after comparison only if a measured baseline exists. The
  current task has no verified before-change user or production baseline; do
  not claim improvement from synthetic metrics alone.
- Note: AI sanity checks are not Track A routing metrics.

## Slide 4 — Architecture and demo components

- **Real application paths:** Student, Reviewer, and Admin portals; FastAPI;
  PostgreSQL; audit trail; workflow guard; public Judge and Verify pages.
- **AI support:** configured Gemini/OpenRouter address services, student RAG,
  and validated attachment OCR.
- **Decision:** deterministic Rule Engine owns final internal routing; a human
  reviewer handles escalated cases.
- **Demo/synthetic:** internal demo SIS data, Verify fixtures, development
  benchmark, and frozen holdout cases.
- No external university SIS connector is present.

## Slide 5 — Limitations, risks, and evidence

- `AUTO_APPROVE` is an internal workflow result, not legal deferment or
  exemption approval.
- HMAC-SHA256 is an integrity/authentication token, not a PKI legal signature.
- AI confidence is not calibrated on production data; address extraction can
  be wrong.
- The fixed development benchmark and frozen holdout are synthetic; the
  holdout is not claimed as externally authored.
- Real-user validation: **PENDING**. No participant counts, quotes, scores, or
  improvements are claimed.
