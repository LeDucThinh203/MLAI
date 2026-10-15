# Final Submission Checklist

Check an item only after reviewing evidence for the final submission revision.
User Validation items must remain unchecked until real sessions are complete.

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

- [ ] Verify Harness returns 9/9 with no network calls or DB writes
- [ ] Fixed Synthetic Development Benchmark runs 18 scenarios
- [ ] Frozen Holdout result is recorded and matches its manifest
- [ ] GitHub Actions is green on the final commit
- [ ] Frontend lint passes
- [ ] Frontend build passes

## Submission material

- [ ] README reflects current source
- [ ] Canonical runbook is current
- [ ] Real-user validation completed with real participants
- [ ] Product improvement is based on participant feedback
- [ ] Five-slide content is final
- [ ] Eight-minute demo rehearsal is complete

## Optional repository setting

- [ ] Optional: enable branch protection and require CI on `main`

`USER VALIDATION: PENDING`. The real-user validation and product-improvement
items above remain unchecked; do not report competition completion before the
evidence exists.
