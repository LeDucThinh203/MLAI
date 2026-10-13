# INTERNAL WORKFLOW POLICY — STUDENT-SERVICE CONFIRMATION
## (`MILITARY_SERVICE_CONFIRMATION`)

> [!IMPORTANT]
> This document describes Team 1's application workflow for the MLAI Hackathon 2026. It is not a legal interpretation, does not establish eligibility for deferment, and does not replace current guidance from competent authorities.

---

### 1. Phạm Vi Áp Dụng & Mục Tiêu

Đây là workflow nội bộ cấp giấy xác nhận sinh viên phục vụ hồ sơ tạm hoãn nghĩa vụ quân sự. It defines how the application routes a case to automatic internal processing or a human reviewer; it does not define a legal procedure or who is legally eligible.

- **Use case:** `MILITARY_SERVICE_CONFIRMATION` only.
- **Data source:** Admin-managed internal demo registry. No external university SIS connector is present.
- **Safety:** Missing or unverified facts must not be inferred or filled in by the application.

---

### 2. Internal Workflow Conditions for `AUTO_APPROVE`

`AUTO_APPROVE` means the internal workflow has enough trusted facts to process automatically. It is not approval of military-service deferment. The current workflow requires:
1. Student identity fields match the internal institutional record.
2. Academic facts meet the workflow's configured active-study checks.
3. The claim uses the workflow's configured permanent-address type.
4. Required address fields are present and do not materially conflict with the recorded address.
5. Institutional provenance is trusted. An internal demo record must have `sourceType=INTERNAL_DEMO_SIS` and `verificationStatus=ADMIN_VERIFIED_DEMO`, with demo trust enabled. A future external source must have `sourceType=EXTERNAL_INSTITUTIONAL_SIS` and `verificationStatus=EXTERNAL_VERIFIED`.
6. Address AI provenance is live, has no fallback, and meets the configured confidence-score threshold. Confidence is not a calibrated probability.

---

### 3. Team 1 Escalation Taxonomy (`ESCALATE_TO_HUMAN`)

These five categories are the taxonomy implemented by Team 1; they are not asserted as required Hackathon category names. A failed or unknown workflow check routes the case for human review:

| Mã Nguyên Nhân | Nhãn Hiển Thị | Tiêu Chí Kích Hoạt Nghiệp Vụ | Hành Động Khuyến Nghị Cán Bộ |
| :--- | :--- | :--- | :--- |
| `OWNERSHIP_UNCLEAR` | Identity mismatch | Submitted identity fields do not match the internal record. | Ask a reviewer to verify the identity record. |
| `FACT_UNKNOWN` | Missing or untrusted facts | Required address, academic, provenance, or AI facts are missing or untrusted. | Request the missing facts or review the source record. |
| `DATA_CONFLICT` | Conflicting facts | The claimed address type or address materially conflicts with the internal workflow facts. | Ask a reviewer to resolve the discrepancy. |
| `AUTHORITY_REQUIRED` | Academic facts need review | Academic status, term, schedule, or course dates need a human check under this workflow. | Route to the responsible institutional reviewer. |
| `POLICY_OUT_OF_SCOPE` | Outside configured workflow | The request asks for an exception or handling beyond this application's configured workflow. | Route for an authorized human decision. |

---

### 4. Cơ Chế Giám Sát Con Người Trong Vòng Lặp (Human-in-the-Loop)

1. **Ghi đè thẩm quyền (Reviewer Override):**
   - Cán bộ thẩm định có quyền ghi đè quyết định của Rule Engine (ví dụ: chuyển từ `ESCALATE_TO_HUMAN` sang `APPROVED` sau khi đã kiểm tra hồ sơ giấy).
   - **Bắt buộc:** Phải cung cấp lý do ghi đè minh bạch (`overrideReason`), lưu vết vĩnh viễn vào Audit Trail toàn trường.
2. **Dừng khẩn cấp tiến trình (`STOP`):**
   - Cho phép đóng băng ngay lập tức các hồ sơ phát hiện dấu hiệu gian lận hoặc tranh chấp pháp lý.
3. **Phản hồi thích ứng ngưỡng (`Reviewer Feedback`):**
   - `MISSED_ESCALATION` (Sót leo thang): Hệ thống tự duyệt sai -> Ngưỡng tin cậy tăng `+0.02` (tối đa `0.90`).
   - `UNNECESSARY_ESCALATION` (Leo thang thừa): Hệ thống leo thang không cần thiết -> Ngưỡng tin cậy giảm `-0.02` (tối thiểu `0.65`).
   - `CORRECT` (Đúng chuẩn): Quyết định chính xác, không thay đổi ngưỡng.
4. **Integrity token and QR lookup:**
   - HMAC-SHA256 provides integrity authentication for stored case fields. It is not a PKI signature or a legal digital signature. The QR page reports whether the stored data matches the HMAC check; it does not independently certify legal validity.
