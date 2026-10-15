# Final Submission Checklist

Check an item only when evidence exists for the code revision under review.
User Validation items must remain unchecked until real sessions are complete.

Code revision `a6bf9076e8b6de471f42e936f7991991ab7cf3de` passed all three GitHub Actions jobs in [run 38686079502](https://github.com/LeDucThinh203/MLAI/actions/runs/38686079502). The docs-only evidence update follows that tested code revision. Frozen Holdout is **NOT RUN**; User Validation is **PENDING**.

## Live product

- [ ] Live URL opens
- [ ] `/judge` opens without login
- [ ] Student login works
- [ ] Reviewer login works
- [ ] Admin login works
- [ ] Student creates a case
- [ ] Rule Engine evaluates the case
- [ ] Escalated case reaches Reviewer
- [ ] Reviewer action works
- [ ] Reviewer feedback changes or preserves threshold as expected
- [ ] Audit record exists

## Evaluation and build

- [x] CI Verify Harness returns 9/9 with no network calls or DB writes
- [x] CI Fixed Synthetic Development Benchmark runs 18 scenarios and checks dataset provenance
- [ ] Frozen Holdout result is recorded and matches its manifest
- [x] GitHub Actions passes on the tested code revision (`a6bf907`)
- [x] Frontend lint passes in CI
- [x] Frontend build passes in CI
- [x] PostgreSQL-backed competition integration suite passes in CI
- [ ] Local final preflight is run

## Submission material

- [x] README reflects current source and CI evidence
- [x] Canonical runbook reflects current checks and limitations
- [ ] Real-user validation completed with real participants
- [ ] Product improvement is based on participant feedback
- [x] Five-slide content reflects current benchmark and holdout status
- [ ] Eight-minute demo rehearsal is complete

`USER VALIDATION: PENDING`. The real-user validation and product-improvement
items above remain unchecked; do not report competition completion before the
evidence exists.
