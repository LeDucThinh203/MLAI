# EDUASSISTANT Architecture

## Supported workflow

`MILITARY_SERVICE_CONFIRMATION` is the single domain: an internal workflow for a student-status confirmation used to support military-service deferment paperwork. The application does not determine legal eligibility or represent a decision by a military authority.

```mermaid
flowchart LR
    Claim[Student claim] --> AddressAI[Address extraction]
    SIS[Institutional facts + provenance] --> Rules[Rule Engine]
    AddressAI --> Rules
    Rules -->|Trusted facts and checks pass| Auto[Internal automatic processing]
    Rules -->|Missing or conflicting facts| Human[Human review]
    Human --> Audit[Audit trail]
    Admin[Admin SIS registry actions] --> Audit
    Auto --> HMAC[HMAC-SHA256 integrity token]
```

## Trust boundaries

- `EXTERNAL_INSTITUTIONAL_SIS` plus `EXTERNAL_VERIFIED` is the external trust path for a future connector. No such connector currently exists.
- `INTERNAL_DEMO_SIS` plus `ADMIN_VERIFIED_DEMO` is accepted only when `ALLOW_ADMIN_VERIFIED_DEMO_SIS=true`. In production this setting defaults to false. The label means Admin checked internal demo facts, not that a university SIS verified them.
- `SYNTHETIC_TEST_SIS` plus `TEST_VERIFIED` is accepted only under an explicit `DETERMINISTIC_TEST` evaluation context. Production request handlers never set that context.
- Missing provenance, `UNVERIFIED`, and `LEGACY_ACCOUNT` records escalate as `FACT_UNKNOWN`.

## AI provenance

The address service tries Google Gemini first, then OpenRouter when configured. Responses include the provider, model, whether an API call was attempted, attempt count, and fallback state. Deterministic parsing of a real address is reported as a parser fallback, not as synthetic input.

AI confidence is a model-generated score, not a calibrated probability. The Rule Engine owns workflow routing; AI does not decide policy or legal eligibility.

## Deterministic evaluation

- Verify Harness: 9 in-memory Rule Engine cases. It performs no network calls, database reads/writes, global AI-mode changes, or threshold mutation.
- Track A Decision Benchmark: 18 fixed synthetic scenarios. `benchmark/run_benchmark.py` performs no AI calls or network access and writes only the local `benchmark/results/latest.json` and `.csv` artifacts.
- Live AI E2E check: `benchmark/run_live_ai_eval.py` runs five address examples separately. It does not alter Track benchmark metrics.

The five escalation categories are the taxonomy implemented by Team 1; they are not claimed as mandatory Hackathon category names.

## Thresholds and human review

The adaptive threshold remains 0.75 by default, bounded by 0.65 and 0.90 with a 0.02 step. `MISSED_ESCALATION` adds 0.02, `UNNECESSARY_ESCALATION` subtracts 0.02, and `CORRECT` leaves it unchanged. Reviewer actions remain `APPROVE`, `REJECT`, `REQUEST_INFO`, `OVERRIDE`, and `STOP`; overrides require a reason and are audited.

## HMAC and public verification

HMAC-SHA256 authenticates the integrity of stored case fields using a shared secret. It is not a PKI signature or legal digital signature. The public `/verify` page checks the HMAC value and displays whether the stored data matches.

## Role-aware AI Agent

```mermaid
flowchart LR
    User[Authenticated user] --> Agent[FastAPI Agent router]
    Agent --> Planner[Gemini planner]
    Planner -->|Unavailable| Router[OpenRouter fallback]
    Agent --> RAG[Allowlisted RAG knowledge base]
    RAG --> Docs[Workflow policy and project docs]
    Agent --> Tools[Role-scoped typed tool registry]
    Tools --> Data[User-scoped live application data]
    Tools --> Existing[Existing case and Admin services]
    Existing --> Rules[Existing Rule Engine and workflow guard]
    Tools -->|Write preview only| Pending[Pending action + explicit user confirmation]
    Pending --> Existing
    Agent --> Audit[Audit trail]
```

The Agent is an assistant/orchestrator, not the Rule Engine or a legal decision maker. Case queries use authorized live tools. RAG is limited to `docs/policies/student_service_policy.md`, `docs/SYSTEM_OVERVIEW.md`, `docs/architecture/ARCHITECTURE.md`, `RUNBOOK.md`, and the runtime `POLICY_REGISTRY`; it never indexes `.env`, uploads, user records, tests, or benchmark artifacts. Citations come only from retrieved chunks. Gemini embeddings are optional; the index remains usable through lexical ranking when no embedding model is configured.

Every tool is allowlisted, schema-validated, and checked against the current role. Student case reads are scoped to the signed-in student. Write tools create a short-lived preview; confirmation rechecks ownership, role, expiration, action integrity, and live workflow state before invoking the existing route/service. Review transitions still pass through `workflow_guard`, and the deterministic Rule Engine and Verify/Track evaluation paths are not invoked by the chat widget.

Conversations and messages are scoped by authenticated user. Provider, model, fallback, call-attempt, duration, retrieved citations, and tool status are retained with assistant messages. Passwords and other credentials are excluded from model context, conversation storage, and Agent audit payloads.
