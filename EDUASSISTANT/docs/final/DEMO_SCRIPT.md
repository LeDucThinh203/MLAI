# Eight-Minute Demo Script

Keep the walkthrough focused on `MILITARY_SERVICE_CONFIRMATION`. The system
supports an internal student-status workflow; it does not decide legal
deferment eligibility.

## 0:00–0:40 — Problem and scope

Explain how incomplete, ambiguous, or conflicting student facts create manual
work and risk unsupported automation. State that an internal workflow result
is not a military authority decision.

## 0:40–1:35 — Student submission

Sign in as a Student and submit one complete permanent-address request. Show
the claim, address analysis, and internal workflow status. Point out that the
Student sees only their own cases and approved student-facing data.

## 1:35–2:20 — Escalation example

Submit or open a synthetic demo case with a temporary address, missing fact,
or material conflict. Show the escalation reason and explain why the Rule
Engine routes uncertainty to a person.

## 2:20–3:30 — Reviewer handles the case

Open the Reviewer queue. Inspect the facts and choose `REQUEST_INFO` or another
appropriate action. Show `OVERRIDE` only with a reason, then show the case
transition and audit entry.

## 3:30–4:20 — Reviewer feedback and adaptive threshold

Submit a clearly labeled demo feedback event. Show the feedback type, threshold
before/after (or unchanged for `CORRECT`), and the audit/history record. State
the 0.75 default, 0.65–0.90 bounds, and 0.02 step.

## 4:20–5:20 — Judge Mode

Open `/judge` without logging in. Distinguish the nine-case Verify Harness, the
18-case Fixed Synthetic Development Benchmark, and the final frozen holdout
result. Show the measured metrics and dataset version/hash only from the
recorded artifacts.

## 5:20–6:05 — Verify Harness

Run the Verify Harness once. Point out the 9/9 result and that it performs no
AI/network calls, database writes, or threshold mutation.

## 6:05–6:50 — Development benchmark and holdout status

Show the recorded development metrics with their actual denominators and the
manual-review-all synthetic reference: 18/18 manual reviews versus 13/18
escalations and 5/18 internal auto-process outcomes. Say “Synthetic workload
reference, not measured production impact.” Frozen Holdout v1 is **NOT RUN**;
show no holdout metrics. The current development artifact is historical and
has not been rerun on this worktree.

## 6:50–7:30 — Audit and synthetic workload reference

Show the Reviewer action audit fields: actor, case, input, result, timestamp,
and reason. Reiterate that the workload comparison is synthetic and does not
measure production impact.

## 7:30–8:00 — Limitations and close

State `USER VALIDATION: PENDING`. The SIS registry is internal demo data and
there is no external university SIS connector. HMAC-SHA256 protects record
integrity; it is not a PKI legal digital signature. AI confidence is not
calibrated on a production population. Legal NVQS decisions remain with the
competent authority. Do not claim user sessions, production outcomes, or
improvements that have not been measured.
