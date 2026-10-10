# User Validation Session Summary Template

## 1. Session Information
- **Session ID:** `UVAL-YYYYMMDD-XX`
- **Date & Time:** `YYYY-MM-DD HH:MM`
- **Participant Role:** `[ Academic Affairs Officer / Student / Administrator ]`
- **Moderator:** `[ Name / Team 1 Member ]`
- **Use Case Evaluated:** `MILITARY_SERVICE_CONFIRMATION` (Cấp giấy xác nhận sinh viên tạm hoãn NVQS)

---

## 2. Tested Scenarios & Tasks
| Task # | Task Description | Target System Response | Observed Outcome | Participant Feedback |
| :--- | :--- | :--- | :--- | :--- |
| T1 | Sinh viên nộp đơn địa chỉ đầy đủ hợp lệ | AUTO_APPROVE | `[ PASS / ESCALATE ]` | |
| T2 | Sinh viên khai báo địa chỉ tạm trú | ESCALATE (`DATA_CONFLICT`) | `[ PASS / FAIL ]` | |
| T3 | Sinh viên thiếu thông tin Phường/Xã | ESCALATE (`FACT_UNKNOWN`) | `[ PASS / FAIL ]` | |
| T4 | Cán bộ thẩm định thực hiện Override có lý do | Status Updated + Audit Log | `[ PASS / FAIL ]` | |
| T5 | Cán bộ gửi Reviewer Feedback (Adaptive) | Threshold Updated | `[ PASS / FAIL ]` | |

---

## 3. Qualitative Usability Metrics
- **Clarity of 3-Layer Information Display (Student Claim vs Institutional Facts vs AI Facts):** `[ 1-5 ]`
- **Clarity of Escalation Reason & Suggested Action:** `[ 1-5 ]`
- **Trust in Rule Engine & Provenance Transparency:** `[ 1-5 ]`
- **Ease of Override / Stop Operations:** `[ 1-5 ]`

---

## 4. Participant Observations & Verbatim Notes
> `[ Participant observations and raw feedback verbatim recorded here ]`

---

## 5. Actionable Insights & System Improvements
1. `[ Issue / Confusion observed -> Planned system improvement ]`
2. `[ Issue / Confusion observed -> Planned system improvement ]`
