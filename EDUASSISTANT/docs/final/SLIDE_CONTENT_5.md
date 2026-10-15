# Five-Slide Submission Content

This file contains slide content only. It is not a PowerPoint deck.

## Slide 1 — Problem and workflow pain

- Students request student-status confirmation for military-service paperwork.
- Missing, ambiguous, or conflicting facts create repeated manual checks.
- EDUASSISTANT aims to route uncertain requests to a human reviewer.
- The system supports an internal workflow; it does not decide legal deferment.

## Slide 2 — Input → processing → output → human

- **Input:** student claim and institutional or explicitly synthetic demo facts.
- **AI support:** address analysis, permitted attachment OCR, and student guidance.
- **Routing authority:** deterministic Rule Engine checks identity, provenance,
  academic facts, address completeness, conflicts, and confidence.
- **Output:** internal `AUTO_APPROVE` or `ESCALATE_TO_HUMAN`.
- **Human:** Reviewer handles escalations, records feedback, and leaves an
  auditable decision.

## Slide 3 — Impact and measurement

- CI run [38686079502](https://github.com/LeDucThinh203/MLAI/actions/runs/38686079502)
  on source revision `a6bf907` measured the fixed synthetic development set:
  Decision Accuracy **100.0% (18/18)**; Automation Rate **27.78% (5/18)**;
  Escalation Rate **72.22% (13/18)**; Missed Escalation **0.0% (0/13)**;
  Unnecessary Escalation **0.0% (0/5)**; AI calls **0**.
- Transparent reference: if every case were sent to a human, **18/18 (100%)**
  would receive manual review. On this synthetic set, EDUASSISTANT routed
  **13/18 (72.22%)** to a human and internally auto-processed **5/18
  (27.78%)**. The difference is a synthetic reviewer-workload reference of
  **5/18 (27.78%)**.
- Label the comparison: **“Synthetic workload reference, not measured production
  impact.”** It is not a measured before/after user or production result.
- Frozen Holdout v1: **NOT RUN**; show no holdout metrics. User Validation:
  **PENDING**.
- AI sanity checks are not Track A routing metrics.

## Slide 4 — Architecture and demo components

- **Implemented application paths:** Student, Reviewer, and Admin portals; FastAPI;
  PostgreSQL; audit trail; workflow guard; public Judge and Verify pages.
- **Optional AI support:** Gemini/OpenRouter services, student RAG, and
  attachment OCR run only when their providers and keys are configured; mock,
  cached, and fallback results are not live AI evidence.
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
