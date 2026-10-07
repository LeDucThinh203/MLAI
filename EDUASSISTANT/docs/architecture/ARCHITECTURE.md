# CASEFLOW AI - SYSTEM ARCHITECTURE
Challenge A: The Escalation Referee (MLAI Hackathon 2026)

## 1. High-Level Architecture Overview
CaseFlow AI is not a conversational chatbot; it is a **Deterministic Workflow and Multimodal Decision Coordinator** with human-in-the-loop safeguards.

```mermaid
graph TD
    A[Student Submits Case & Evidence] --> B[File Validation & SHA-256 Storage]
    B --> C[Gemini VLM Multimodal Extraction]
    C --> D[Pydantic Structured Validation]
    D --> E[Evidence Comparison vs SIS Records]
    E --> F[Deterministic Rule Engines]
    
    subgraph Deterministic Engines
        F --> G[UncertaintyEngine]
        G --> H[EvidenceComparison]
        H --> I[PolicyEngine]
        I --> J[AuthorityEngine]
        J --> K[DecisionEngine]
    end
    
    K -->|Routine Match| L[AUTO_RESOLVE]
    K -->|Conflict / Uncertain / Exceeds Authority| M[ESCALATE to Human Officer]
    M --> N[Accountable Human Review Portal]
    N --> O[Approve / Reject / Override / Stop]
    
    L --> P[Immutable Audit Trail]
    O --> P
```

## 2. Core Principles
1. **Gemini does NOT make autonomous policy decisions:** LLM/VLM is solely an extraction and communication assistant.
2. **Safe Fallback & Zero Hallucination:** Incomplete or blurred fields trigger `FACT_UNKNOWN`.
3. **Accountability:** Every state transition records Who, What, When, Input, Evidence, Why, Policy, and Result.
