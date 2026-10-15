# Limitations and Risks

- There is no external university SIS connector. The internal SIS registry contains demo records and is not an authoritative institutional source.
- Production disables trust in admin-verified demo SIS records with `ALLOW_ADMIN_VERIFIED_DEMO_SIS=false`.
- AI address normalization and confidence scores can be wrong. Confidence is not statistically calibrated on a production population. Provider failures use a deterministic fallback and cases without sufficient trusted evidence must be routed for human review.
- The fixed 18-case benchmark is synthetic and reproducible; it is not independent, held out, or a production accuracy estimate.
- Independent evaluation is **PENDING** until an independently frozen dataset with provenance is supplied.
- User validation is **PENDING** until real participants complete sessions and evidence is recorded.
- `AUTO_APPROVE` is an internal workflow outcome. EDUASSISTANT does not decide legal eligibility for military-service deferment or exemption and does not issue an official legal certificate.
- HMAC-SHA256 is an integrity/authentication token for record status within EDUASSISTANT. It is not a PKI signature, qualified signature, or legal digital signature, and it does not certify legal authenticity outside the system.
