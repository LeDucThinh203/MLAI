# Five Slide Submission Content

## SLIDE 1 — Problem and Current Workflow

- Students submit requests to confirm student status for military-service paperwork.
- Incomplete, ambiguous, or conflicting facts create uncertainty for staff.
- Unsafe automation can produce an unsupported internal result.
- EDUASSISTANT routes uncertain cases to a reviewer; it does not decide legal deferment or exemption.

## SLIDE 2 — Input, Processing, Output, Human Decision

- **Input:** student claim, internal institutional facts, and AI-derived address facts.
- **Processing:** AI normalization; deterministic Rule Engine; adaptive escalation threshold.
- **Output:** `AUTO_APPROVE` as an internal workflow action, or `ESCALATE_TO_HUMAN`.
- **Human:** Reviewer can approve, reject, request information, override with a reason, or stop; reviewer feedback is recorded for the adaptive policy.

## SLIDE 3 — Impact and Measurement

**FIXED SYNTHETIC BENCHMARK — local run, 2026-10-15 03:56:08 UTC**

- 18 cases; 18 correct; decision accuracy **100.0% (18/18)**.
- Automation rate **27.78% (5/18)**; escalation rate **72.22% (13/18)**.
- Missed escalation **0/13 (0.0%)**; unnecessary escalation **0/5 (0.0%)**.
- AI calls: **false**.
- Independent evaluation: **PENDING** until a genuinely independent frozen dataset is supplied.
- Real user validation: **PENDING** until real sessions are completed.

These results describe only the fixed synthetic cases and do not estimate production accuracy.

## SLIDE 4 — Architecture and Real vs Simulated

- **Application components:** deployed frontend and backend, PostgreSQL, and Gemini/OpenRouter when configured.
- **Human workflow:** Reviewer actions, feedback, audit events, and threshold history.
- **Synthetic evaluation:** internal demo SIS records, nine deterministic Verify scenarios, and the fixed 18-case benchmark.
- There is no external university SIS connector. Demo records are not authoritative institutional facts.

## SLIDE 5 — Limitations, Risks, Next Steps

- Connect to an authoritative university SIS only through a separately approved integration.
- AI address normalization can be wrong; confidence is not calibrated on a production population.
- The fixed synthetic benchmark is not independent; independent evaluation is PENDING.
- Real user validation is PENDING until completed with more than three real participants.
- EDUASSISTANT supports paperwork and internal student-status confirmation; it does not determine legal deferment eligibility.
