# EDUASSISTANT - SYSTEM ARCHITECTURE
> **Track VNG – Option A: The Escalation Referee (MLAI Hackathon 2026)**  
> **Chuyên đề Nghiệp vụ Sâu:** Cấp Giấy Xác Nhận Sinh Viên Phục Vụ Tạm Hoãn Nghĩa Vụ Quân Sự (`MILITARY_SERVICE_CONFIRMATION`)

---

## 1. High-Level Architecture Overview
EDUASSISTANT is an **Autonomous Workflow & Multimodal Decision Coordinator** with strict Human-in-the-Loop safeguards and an Escalation Referee engine, specializing deeply in military service deferment certification (`MILITARY_SERVICE_CONFIRMATION`).

```mermaid
graph TD
    A[Student Submits NVQS Claim] --> B[Three-Layer Fact Resolution]
    
    subgraph Three Fact Layers
        L1[Layer 1: Authoritative Institutional Facts<br/>academicStatus, registeredPermanentAddress, courseDates]
        L2[Layer 2: Student Claims<br/>declaredAddress, addressType: PERMANENT/TEMPORARY, requestReason]
        L3[Layer 3: AI-Derived Facts<br/>Gemini Address Parsing, Confidence, Missing Fields]
    end
    
    B --> L1
    B --> L2
    B --> L3
    
    L1 & L2 & L3 --> R[Hierarchical Escalation Referee]
    
    subgraph Escalation Referee Engine (Priority Cascade)
        R --> C1[1. OWNERSHIP_UNCLEAR: Student identity / MSSV mismatch]
        C1 --> C2[2. POLICY_OUT_OF_SCOPE: Exception requests beyond policy]
        C2 --> C3[3. AUTHORITY_REQUIRED: Academic status SUSPENDED / WITHDRAWN]
        C3 --> C4[4. DATA_CONFLICT: AddressType TEMPORARY]
        C4 --> C5[5. FACT_UNKNOWN: Incomplete address / Low AI confidence]
        C5 --> C6[6. DATA_CONFLICT: Material address mismatch]
        C6 --> C7[7. FAILSAFE: Non-Live AI mode mock/cache/fallback]
    end
    
    C7 -->|All Checks Pass & Complete Normalization| APP[AUTO_APPROVE<br/>Digital HMAC-SHA256 Signature + QR]
    C1 & C2 & C3 & C4 & C5 & C6 & C7 -->|Triggered| ESC[ESCALATE_TO_HUMAN<br/>Status: UNDER_REVIEW]
    
    ESC --> REV[Human Reviewer Portal (3-Layer Inspection)]
    REV --> ACT[Actions: APPROVE / REJECT / REQUEST_INFO / OVERRIDE / STOP]
    ACT --> FB[Reviewer Feedback -> Adaptive Escalation Threshold [0.65, 0.90]]
    APP & ACT --> AUD[Immutable Audit Trail (Who, When, Input, Result, Reason)]
```

---

## 2. Three Distinct Fact Layers
To eliminate hallucinations and prevent AI overreach in administrative decisions, EDUASSISTANT strictly bifurcates facts into three distinct layers:

1. **Lớp Dữ Kiện Thẩm Quyền Nhà Trường (Authoritative Institutional Facts):**
   - Source: Student Information System (SIS) / Academic Registry.
   - Fields: `studentId`, `studentCode`, `fullName`, `academicStatus` (`ACTIVE`, `SUSPENDED`, `WITHDRAWN`), `courseStartDate`, `courseEndDate`, `currentTermActive`, `hasCurrentSchedule`, `registeredPermanentAddress`.
   - Immutable truth against which claims are audited.
2. **Lớp Tuyên Bố của Sinh Viên (Student Claims):**
   - Source: Student application form submission.
   - Fields: `declaredAddress`, `addressType` (`PERMANENT` vs `TEMPORARY`), `requestReason`, `notes`.
   - Represents the student's assertion seeking deferment certification.
3. **Lớp Dữ Kiện Trích Xuất AI (AI-Derived Facts):**
   - Source: Gemini Address Normalization / Deterministic Administrative Parser.
   - Fields: `rawAddress`, `parsed` (`houseNumber`, `street`, `ward`, `district`, `province`), `normalized`, `missingFields`, `isComplete`, `confidence`, `provenance`.
   - AI is strictly limited to linguistic extraction and syntactic normalization; it is **forbidden from asserting legal deferment eligibility**.

---

## 3. Formatting Invariance & Material Conflict Resolution
The Escalation Referee distinguishes between pure formatting differences and genuine material data conflicts:
- **Pure Formatting Invariance (Allowed for Auto-Approve):**
  - ALL CAPS (`QUẬN 1, TP. HỒ CHÍ MINH`) vs lowercase (`quận 1, tp. hồ chí minh`).
  - Standard Vietnamese administrative abbreviations: `P.` / `Phường`, `Q.` / `Quận`, `TP.` / `Thành phố`, `TX.` / `Thị xã`, `H.` / `Huyện`.
  - Abbreviation without dots: `p ben nghe`, `q1`, `tphcm`.
  - When address components (Ward, District, Province) match semantically and address is complete with confidence $\ge$ threshold, the case is **AUTO_APPROVE** without unnecessary human escalation.
- **Material Conflict (Must Escalate):**
  - Different province (e.g. `Hà Nội` vs `TP. Hồ Chí Minh`).
  - Different district in the same province (e.g. `Quận 3` vs `Quận 1`).
  - Different ward in the same district (e.g. `Phường Đa Kao` vs `Phường Bến Nghé`).
  - Declared address marked as `TEMPORARY` (NVQS deferment by law requires permanent registration jurisdiction).

---

## 4. Seven Core Architectural Safeguards
1. **Gemini does NOT decide policy:** LLM/VLM functions solely as an address parser and normalization utility. The legal status of deferment is evaluated solely by deterministic rules.
2. **Safe Fallback & Non-Live Fail-Safe:** If `AI_MODE` is mock, cache, fallback, or synthetic, the system categorically denies `AUTO_APPROVE` and escalates to `ESCALATE_TO_HUMAN` (`FACT_UNKNOWN`, `UNDER_REVIEW`).
3. **Single Source of Truth for AI Mode:** `ai_service.get_ai_mode()` is the global runtime truth controlling normalization, OCR, and provenance metadata simultaneously.
4. **Adaptive Escalation Threshold:** A dynamic threshold clamped in `[0.65, 0.90]` adjusts deterministically (+0.02 upon `MISSED_ESCALATION`, -0.02 upon `UNNECESSARY_ESCALATION`) based on human reviewer feedback.
5. **Workflow Transition Guard:** Status progressions follow deterministic state transitions (`SUBMITTED -> UNDER_REVIEW -> APPROVED / REJECTED / REQUIRES_SUPPLEMENT / STOPPED`). Terminal states cannot be reverted without explicit administrative override.
6. **Immutable Audit Accountability:** Every state transition and decision persists Who, When, Case, Input Data, Result, and Reason.
7. **Deterministic Verify Harness (9 Scenarios):** Endpoints (`POST /api/verify/run`) and executable benchmarks (`benchmark/run_benchmark.py`) provide judges and evaluators with reproducible, in-memory validation achieving 100% PASS on 9 NVQS scenarios.
