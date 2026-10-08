# EDUASSISTANT - MEASUREMENT & EVALUATION PLAN
Track VNG – Option A: The Escalation Referee (MLAI Hackathon 2026)
Methodology for Quantifying Impact & Decision Accuracy (Strictly No Fabricated Metrics)

## 1. Operational Efficiency & Workflow Metrics
- **End-to-End Resolution Time (E2E):** Duration from initial case submission until terminal state (`APPROVED`, `REJECTED`, `STOPPED`).
- **Waiting Time:** Duration cases sit unhandled in `UNDER_REVIEW` before officer evaluation.
- **Number of Handoffs:** Count of department-to-department transfers before reaching a final resolution.

## 2. Decision Quality & Safeguard Metrics
- **Decision Accuracy:** Rate of system recommendations matching ground truth policies:
  $$\text{Decision Accuracy} = \frac{\text{Correct Cases}}{\text{Total Cases}} \times 100\%$$
- **Automation Rate:** % of routine cases successfully resolved by `AUTO_APPROVE` without human intervention:
  $$\text{Automation Rate} = \frac{\text{Auto-Approved Cases}}{\text{Total Cases}} \times 100\%$$
- **Escalation Rate:** % of cases safely routed to human officers due to ambiguity, conflict, or authority limits:
  $$\text{Escalation Rate} = \frac{\text{Escalated Cases}}{\text{Total Cases}} \times 100\%$$
- **Missed Escalation Rate (Critical Safety Metric):** % of cases that should have stopped for human judgment but were erroneously auto-resolved:
  $$\text{Missed Escalation Rate} = \frac{\text{Escalate Cases Erroneously Auto-Approved}}{\text{Total Cases Expected to Escalate}} \times 100\%$$
  *(Target: 0.00% safe boundary)*
- **Unnecessary Escalation Rate:** % of routine, unambiguous cases escalated needlessly:
  $$\text{Unnecessary Escalation Rate} = \frac{\text{Routine Cases Erroneously Escalated}}{\text{Total Cases Expected to Auto-Approve}} \times 100\%$$
- **Human Override Count:** Frequency with which an officer reverses the recommendation of the system with mandatory documented reasons (`HUMAN_OVERRIDE`).

## 3. Executable Benchmark Suite
The project provides an automated, reproducible benchmark runner:
- **Held-Out Test Cases:** `EDUASSISTANT/benchmark/held_out_cases.json` (covering routine cases and all 5 escalation reasons: `FACT_UNKNOWN`, `DATA_CONFLICT`, `AUTHORITY_REQUIRED`, `POLICY_OUT_OF_SCOPE`, `OWNERSHIP_UNCLEAR`).
- **Benchmark Runner:** `EDUASSISTANT/benchmark/run_benchmark.py`
- **Output Artifacts:**
  - `EDUASSISTANT/benchmark/results/latest.json`
  - `EDUASSISTANT/benchmark/results/latest.csv`
- **Command to Execute:**
  ```bash
  python benchmark/run_benchmark.py
  ```

## 4. Adaptive Threshold & Human Feedback Loop
Reviewers submit feedback (`POST /api/cases/{case_id}/feedback`):
- `CORRECT`: Threshold remains unchanged.
- `MISSED_ESCALATION`: Threshold increases by +0.02 (tightening automation, prioritizing safety).
- `UNNECESSARY_ESCALATION`: Threshold decreases by -0.02 (relieving human review burden).
- **Bounds:** Strictly clamped within `[0.65, 0.90]`.
