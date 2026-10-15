# Eight-Minute Demo Script

Keep the walkthrough focused on `MILITARY_SERVICE_CONFIRMATION`. The system
supports an internal student-status workflow; it does not decide legal
deferment eligibility.

## 0:00–0:40 — Problem and workflow pain

Explain how incomplete, ambiguous, or conflicting student facts create manual
work and risk unsupported automation. State that an internal workflow result
is not a military authority decision.

## 0:40–1:40 — Student normal submission

Sign in as a Student and submit one complete permanent-address request. Show
the claim, address analysis, and internal workflow status. Point out that the
Student sees only their own cases and approved student-facing data.

## 1:40–2:35 — Escalation example

Submit or open a synthetic demo case with a temporary address, missing fact,
or material conflict. Show the escalation reason and explain why the Rule
Engine routes uncertainty to a person.

## 2:35–3:45 — Reviewer handles the case

Open the Reviewer queue. Inspect the facts and choose `REQUEST_INFO` or another
appropriate action. Show `OVERRIDE` only with a reason, then show the case
transition and audit entry.

## 3:45–4:35 — Reviewer feedback

Submit a clearly labeled demo feedback event. Show the feedback type, threshold
before/after (or unchanged for `CORRECT`), and the audit/history record. State
the 0.75 default, 0.65–0.90 bounds, and 0.02 step.

## 4:35–5:35 — Judge Mode

Open `/judge` without logging in. Distinguish the nine-case Verify Harness, the
18-case Fixed Synthetic Development Benchmark, and the final frozen holdout
result. Show the measured metrics and dataset version/hash only from the
recorded artifacts.

## 5:35–6:20 — Verify Harness

Run the Verify Harness once. Point out the 9/9 result and that it performs no
AI/network calls, database writes, or threshold mutation.

## 6:20–7:00 — Development benchmark metrics

Show Decision Accuracy, Automation Rate, Escalation Rate, Missed Escalation
Rate, and Unnecessary Escalation Rate with their actual denominators. Explain
that this fixed synthetic set is development evidence, not production
validation. Do not invent a before/after baseline.

## 7:00–7:35 — Limitations

State that the SIS registry is internal demo data and there is no external
university SIS connector. HMAC-SHA256 protects record integrity; it is not a
PKI legal digital signature. AI confidence is not calibrated on a production
population. Legal NVQS decisions remain with the competent authority.

## 7:35–8:00 — User validation status and close

State `USER VALIDATION: PENDING`. Real-user sessions have not been completed
for this task. Do not claim participants, quotes, scores, screenshots, or
product improvements that do not exist.
