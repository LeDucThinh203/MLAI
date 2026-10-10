# Internal Student Service Workflow Policy (Prototype)

## Scope and authority

This document describes the software workflow implemented in EDUASSISTANT. It is an internal prototype policy, not a legal opinion, official institutional policy, or government procedure. The project has no verified connection to an institution's student information system or a competent military authority.

An `APPROVED` case means only that the prototype workflow reached its approved state. A generated receipt, QR code, or HMAC value is not an official certificate, a public-key digital signature, proof of legal eligibility, or a decision to defer military service. Only the competent institution and public authority can verify eligibility and issue official documents under the rules in force.

The current address and academic checks are conservative demo rules. Before real deployment, the institution must validate the policy, data sources, retention, staff authority, and document wording with its legal and academic-affairs offices. Do not infer current law from this code or document.

## Authoritative data and claims

- The server derives the submitting identity from the authenticated account. Client-supplied identity fields are not authoritative.
- When present, `sis_student_records` is the canonical academic record; legacy `users` fields are a compatibility fallback. Missing facts must remain missing and cause human review.
- The student's declared address and reason are claims. AI output may parse or normalize the address, but it cannot establish identity, residence, academic status, or legal eligibility.
- Seeded and admin-maintained internal SIS records are not authenticated SIS integrations. The engine escalates unless the record source is explicitly `VERIFIED_INSTITUTIONAL_SIS`. Mock, cached, synthetic, or fallback AI results also cannot be represented as verified real-world facts.

## Prototype automatic-workflow checks

The rule engine may mark a case `AUTO_APPROVE` only when all implemented checks pass, including a trusted `VERIFIED_INSTITUTIONAL_SIS` source: exact normalized student-code and full-name match; `academicStatus = ACTIVE`; course dates are valid and include the current date; current term and schedule are explicitly true; address type is `PERMANENT`; address has a house number, street/locality, ward/commune, and province/city; an institutional permanent address exists and has no material conflict; AI confidence is at least the configured threshold; and the AI provenance is live, non-fallback, and non-synthetic.

The parser does not require a district. This matches a two-tier local-administration address format and supports records that do not contain a district. A missing district alone is not a reason to escalate. The prototype's `PERMANENT` check is an internal workflow constraint; this document does not claim that it is a statutory requirement for every real application.

Passing these checks only marks the internal workflow recommendation. It does not authorize the software to issue an official certificate or make a legal decision.

## Human review

The system routes a case for staff review when identity is missing or mismatched (`OWNERSHIP_UNCLEAR`), facts are missing or AI provenance/confidence is inadequate (`FACT_UNKNOWN`), claimed and stored addresses materially conflict or the claim is temporary (`DATA_CONFLICT`), academic records are missing, out of date, inactive, or otherwise not `ACTIVE` (`AUTHORITY_REQUIRED`), or the request asks for an exception beyond the prototype workflow (`POLICY_OUT_OF_SCOPE`).

Reviewers must record a reason for their action. Returning a case for more information, stopping it, or making an administrative override follows the workflow transition guard. The guard protects application state; it does not grant legal authority.

## Workflow states

`SUBMITTED` may move to `UNDER_REVIEW`, `REQUIRES_SUPPLEMENT`, or `STOPPED`. `UNDER_REVIEW` may move to `APPROVED`, `REJECTED`, `REQUIRES_SUPPLEMENT`, or `STOPPED`. `REQUIRES_SUPPLEMENT` may move to `UNDER_REVIEW` or `STOPPED`. Terminal states require an explicitly authorized admin override to reopen.

## Adaptive threshold

The confidence threshold is a configurable prototype control, bounded by 0.65 and 0.90 with 0.02 feedback steps. Reviewer feedback changes the workflow threshold only; it does not change legal criteria or prove model calibration. A single feedback event must not be treated as institutional policy approval.

## Required before real-world use

Connect an authenticated, audited institutional SIS source and set its trusted provenance only from that integration; establish an explicit data-verification and record-freshness process; have the competent institution approve the eligibility and address rules; separate internal recommendations from authorized issuance; use an approved digital-signature mechanism if official documents are ever issued; and obtain privacy/security review for personal data and public verification links.
