# 8-Minute Demo Script

## 0:00–0:45 — Problem and scope

Explain the student-status confirmation workflow and why ambiguous, incomplete, or conflicting cases should go to a human. State that EDUASSISTANT supports paperwork preparation and does not determine legal deferment eligibility.

## 0:45–2:00 — Student request

Show the Student Portal and submit one normal permanent-address example. Point out the student claim, internal facts, and AI-derived address fields. Show a second example that requires escalation, such as a temporary or conflicting address. Describe `AUTO_APPROVE` only as internal processing.

## 2:00–4:00 — Reviewer decision

Open the Reviewer queue and inspect the escalation reason. Demonstrate an authorized action such as `REQUEST_INFO` or `APPROVE`, then show that `OVERRIDE` requires a reason. Show how `STOP` is recorded.

## 4:00–5:00 — Feedback and audit

Show Reviewer feedback (`CORRECT`, `MISSED_ESCALATION`, or `UNNECESSARY_ESCALATION`), the resulting threshold history, and the corresponding audit event. Explain the default, bounds, and step size.

## 5:00–6:20 — Judge Mode

Open `/judge`. Run the nine-case Verify Harness with one click. Show the fixed synthetic benchmark's measured rates and raw denominators. State that independent evaluation remains PENDING unless a frozen dataset is available.

## 6:20–7:10 — Student Agent

Briefly show one stable student-scoped policy or own-case question. Demonstrate OCR attachment handling only if the current deployment is stable. Keep this section short; Reviewer and escalation evidence are the focus.

## 7:10–8:00 — Limitations and close

State that the internal SIS registry is demo data and there is no external university SIS connector. AI address normalization can be wrong. User validation remains PENDING until real sessions are completed. Close by explaining the human escalation and audit trail.
