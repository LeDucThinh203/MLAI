# User Validation Test Plan

**Status: PENDING.** This plan prepares moderated sessions for the main student-status confirmation workflow. It does not record completed participants, observations, scores, or quotations.

Use synthetic test accounts and approved test records. Do not use real student data in screenshots, recordings, or notes. Leave every observation field as `PENDING` until a real session occurs.

## UV-01 — Complete permanent address

- **Goal:** Check that a student can submit a complete permanent-address claim and understand the workflow response.
- **Provided input:** A complete permanent address from an approved synthetic test fixture and an eligible, explicitly trusted test record.
- **Task:** Submit a `MILITARY_SERVICE_CONFIRMATION` request and explain the result shown on screen.
- **Expected system behavior:** The Rule Engine may return `AUTO_APPROVE` for internal processing only when all required trusted facts and policy checks pass. The screen must not describe this as a legal deferment decision.
- **Observed behavior:** [PENDING]
- **Participant quote:** [PENDING]
- **Completion time:** [PENDING]
- **Needed moderator help:** [PENDING]
- **Feedback:** [PENDING]

## UV-02 — Temporary address

- **Goal:** Check whether the student understands why a temporary-address request is routed for review.
- **Provided input:** A temporary-address claim from an approved synthetic test fixture.
- **Task:** Submit the request and describe the next step shown by the system.
- **Expected system behavior:** Route the case to a human reviewer with an explainable reason; do not auto-process it as a permanent-address match.
- **Observed behavior:** [PENDING]
- **Participant quote:** [PENDING]
- **Completion time:** [PENDING]
- **Needed moderator help:** [PENDING]
- **Feedback:** [PENDING]

## UV-03 — Incomplete permanent address

- **Goal:** Check whether the student can identify and supply a missing address component.
- **Provided input:** A permanent-address claim with one or more required administrative components omitted.
- **Task:** Submit the request and describe what information is missing or what action is needed.
- **Expected system behavior:** Do not auto-process an incomplete address; explain the missing information or route the case for review according to the current Rule Engine result.
- **Observed behavior:** [PENDING]
- **Participant quote:** [PENDING]
- **Completion time:** [PENDING]
- **Needed moderator help:** [PENDING]
- **Feedback:** [PENDING]

## UV-04 — Material address conflict

- **Goal:** Check whether the reviewer can locate and understand a substantive conflict between the student's claim and stored institutional facts.
- **Provided input:** A permanent-address claim that materially differs from the approved synthetic institutional address.
- **Task:** Review the escalated case and explain the conflict and chosen action.
- **Expected system behavior:** Escalate the case with a visible conflict reason; leave the decision to an authorized reviewer.
- **Observed behavior:** [PENDING]
- **Participant quote:** [PENDING]
- **Completion time:** [PENDING]
- **Needed moderator help:** [PENDING]
- **Feedback:** [PENDING]

## UV-05 — Special or out-of-scope request

- **Goal:** Check whether a reviewer can recognize a request that needs human interpretation.
- **Provided input:** A special or policy-out-of-scope note using an approved synthetic test fixture.
- **Task:** Submit or review the case and describe why a person must decide the next step.
- **Expected system behavior:** Escalate for human review with the applicable reason. EDUASSISTANT does not decide legal eligibility for military-service deferment or exemption.
- **Observed behavior:** [PENDING]
- **Participant quote:** [PENDING]
- **Completion time:** [PENDING]
- **Needed moderator help:** [PENDING]
- **Feedback:** [PENDING]

## Session close

Ask the participant to describe the clearest part of the workflow, any point of uncertainty, and one change that would help. Record verbatim feedback only with consent. Capture task outcomes in a session file under `sessions/`, then summarize only observed evidence in `summary-template.md`.
