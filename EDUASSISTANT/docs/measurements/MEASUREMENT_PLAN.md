# EDUASSISTANT - MEASUREMENT & EVALUATION PLAN
> **Track VNG – Option A: The Escalation Referee (MLAI Hackathon 2026)**  
> **Chuyên đề Nghiệp vụ Sâu:** Cấp Giấy Xác Nhận Sinh Viên Phục Vụ Tạm Hoãn Nghĩa Vụ Quân Sự (`MILITARY_SERVICE_CONFIRMATION`)  
> **Phương pháp Định lượng Hiệu quả & Độ chính xác Thẩm định (Tuyệt đối không bịa đặt số liệu)**

---

## 1. Operational Efficiency & Workflow Metrics
- **End-to-End Resolution Time (E2E):** Thời gian từ khi sinh viên gửi đơn NVQS đến khi đạt trạng thái cuối cùng (`APPROVED`, `REJECTED`, `STOPPED`).
- **Waiting Time:** Thời gian hồ sơ nằm trong hàng đợi `UNDER_REVIEW` chờ cán bộ Phòng Đào tạo thẩm định.
- **Number of Handoffs:** Số lần chuyển giao giữa sinh viên và cán bộ hoặc giữa các phòng ban.

---

## 2. Decision Quality & Safeguard Metrics
- **Decision Accuracy:** Tỷ lệ khuyến nghị của hệ thống trùng khớp với quy chuẩn thẩm định:
  $$\text{Decision Accuracy} = \frac{\text{Số ca quyết định đúng}}{\text{Tổng số ca kiểm thử}} \times 100\%$$
- **Automation Rate:** Tỷ lệ hồ sơ thường quy hợp lệ được tự động phê duyệt (`AUTO_APPROVE`) mà không cần con người can thiệp:
  $$\text{Automation Rate} = \frac{\text{Số ca duyệt tự động}}{\text{Tổng số ca kiểm thử}} \times 100\%$$
- **Escalation Rate:** Tỷ lệ hồ sơ được định tuyến an toàn tới cán bộ thẩm định (`ESCALATE_TO_HUMAN`):
  $$\text{Escalation Rate} = \frac{\text{Số ca leo thang}}{\text{Tổng số ca kiểm thử}} \times 100\%$$
- **Missed Escalation Rate (Chỉ số An toàn Sống còn):** Tỷ lệ hồ sơ có rủi ro/sai phạm nhưng bị hệ thống tự động phê duyệt sai:
  $$\text{Missed Escalation Rate} = \frac{\text{Số ca cần leo thang nhưng bị tự động duyệt}}{\text{Tổng số ca kỳ vọng leo thang}} \times 100\%$$
  *(Mục tiêu an toàn tuyệt đối: 0.00%)*
- **Unnecessary Escalation Rate (Chỉ số Tối ưu Vận hành):** Tỷ lệ hồ sơ thường quy đầy đủ hợp lệ nhưng bị đẩy lên con người vô cớ:
  $$\text{Unnecessary Escalation Rate} = \frac{\text{Số ca thường quy hợp lệ nhưng bị leo thang}}{\text{Tổng số ca kỳ vọng duyệt tự động}} \times 100\%$$
  *(Mục tiêu: 0.00% - Phân biệt chính xác giữa khác biệt format và xung đột dữ kiện)*
- **Human Override Count:** Số lần cán bộ ghi đè khuyến nghị của hệ thống với lý do bắt buộc (`HUMAN_OVERRIDE`).

---

## 3. Executable Benchmark Suite (18 Held-Out NVQS Cases)
Hệ thống cung cấp công cụ Benchmark tự động, thực thi hoàn toàn độc lập in-memory:
- **Tập ca kiểm chuẩn độc lập:** `EDUASSISTANT/benchmark/held_out_cases.json` (18 ca bao phủ các nhánh: thường quy, chữ HOA, chữ thường, viết tắt `P.`/`Q.`/`TP.`, viết tắt không dấu `p ben nghe q1`, thiếu phường, thiếu tỉnh, địa chỉ trống, độ tin cậy thấp, địa chỉ tạm trú, xung đột tỉnh, xung đột huyện, xung đột xã, sinh viên đình chỉ học, thôi học, xin đặc cách vượt thời gian, sai MSSV, fail-safe AI).
- **Trình thực thi:** `EDUASSISTANT/benchmark/run_benchmark.py`
- **Kết quả đo lường hiện tại:**
  - **Decision Accuracy:** `100.0% (18/18)`
  - **Automation Rate:** `27.78% (5/18)`
  - **Escalation Rate:** `72.22% (13/18)`
  - **Missed Escalation Rate:** `0.0% (0/13)` *(Đạt chuẩn an toàn tuyệt đối)*
  - **Unnecessary Escalation Rate:** `0.0% (0/5)` *(Đạt chuẩn tối ưu hóa vận hành)*
  - **Thời gian thực thi:** `< 0.02s`
- **Tệp xuất dữ liệu:**
  - `EDUASSISTANT/benchmark/results/latest.json`
  - `EDUASSISTANT/benchmark/results/latest.csv`

---

## 4. Adaptive Threshold & Human Feedback Loop
Cán bộ gửi phản hồi qua `POST /api/cases/{case_id}/feedback`:
- `CORRECT`: Giữ nguyên ngưỡng tin cậy.
- `MISSED_ESCALATION`: Tăng ngưỡng +0.02 (thắt chặt an toàn).
- `UNNECESSARY_ESCALATION`: Giảm ngưỡng -0.02 (giảm tải cán bộ).
- **Phạm vi kẹp an toàn (Clamping Bounds):** Nghiêm ngặt trong khoảng `[0.65, 0.90]`.
