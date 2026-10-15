# Limitations and Risks

- There is no external university SIS connector. The internal SIS registry
  contains demo records and is not an authoritative institutional source.
- Production sets `ALLOW_ADMIN_VERIFIED_DEMO_SIS=false`; internal demo facts
  cannot authorize `AUTO_APPROVE` there. Synthetic test facts are accepted only
  in an explicit deterministic test context.
- AI address normalization and confidence can be wrong. Confidence has not
  been calibrated on a production population. Provider failures use a
  deterministic parser and are routed with fail-safe provenance.
- The 18-case Fixed Synthetic Development Benchmark is fixed and synthetic; it
  is not an independent, held-out, or production-accuracy evaluation.
- The 36-case Frozen Holdout is separate and frozen by SHA-256. It was authored
  for this repository and is not claimed to be externally or independently
  authored. It is not user validation.
- User validation is **PENDING** until real participants complete sessions and
  evidence is recorded.
- `AUTO_APPROVE` is an internal workflow outcome. EDUASSISTANT does not decide
  legal eligibility for military-service deferment or exemption and does not
  issue an official legal certificate.
- HMAC-SHA256 is an integrity/authentication token for record status within
  EDUASSISTANT. It is not a PKI signature, qualified signature, or legal digital
  signature, and it does not certify legal authenticity outside the system.
