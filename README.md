# 🎖️ EDUASSISTANT - HỆ THỐNG THẨM ĐỊNH HỌC VỤ & CẤP GIẤY XÁC NHẬN TẠM HOÃN NGHĨA VỤ QUÂN SỰ
> **Đội Thi:** Team 1 | **Cuộc Thi:** MLAI Hackathon 2026 | **Track VNG – Option A:** The Escalation Referee & HITL  
> **Nghiệp Vụ Chuyên Sâu Duy Nhất:** Cấp Giấy Xác Nhận Sinh Viên Phục Vụ Tạm Hoãn Nghĩa Vụ Quân Sự (`MILITARY_SERVICE_CONFIRMATION`)  
> Nền tảng thẩm định hành chính học vụ chuyên sâu kết hợp **AI Address Normalization (Google Gemini)**, **Bộ máy Phân xử Leo thang (Escalation Referee 5 Lý do)**, **Kiến trúc 3 Lớp Dữ kiện (Institutional Facts - Student Claims - AI-Derived Facts)**, **Bảo mật Doanh nghiệp (JWT, Bcrypt, 2FA TOTP, Chống IDOR, Ký số HMAC-SHA256)**, **Adaptive Escalation Threshold [0.65, 0.90]**, **Bộ Kiểm Chuẩn Độc Lập (18 Cases Held-Out Benchmark - 100% Accuracy)** và **Verify Harness Giám Khảo (9 Kịch bản Xác định - 100% PASS)**.

---

## 📑 MỤC LỤC
1. [Mục Tiêu & Bài Toán Nghiệp Vụ Chuyên Sâu (NVQS Domain)](#1-mục-tiêu--bài-toán-nghiệp-vụ-chuyên-sâu-nvqs-domain)
2. [Kiến Trúc 3 Lớp Dữ Kiện & Quy Tắc An Toàn AI](#2-kiến-trúc-3-lớp-dữ-kiện--quy-tắc-an-toàn-ai)
3. [Cơ Chế Phân Xử Leo Thang (Escalation Referee 5 Lý Do)](#3-cơ-chế-phân-xử-leo-thang-escalation-referee-5-lý-do)
4. [Tính Bất Biến Định Dạng & Nhận Diện Xung Đột Thực Chất](#4-tính-bất-biến-định-dạng--nhận-diện-xung-đột-thực-chất)
5. [Cổng Giám Khảo & Verify Harness 9 Kịch Bản (/judge)](#5-cổng-giám-khảo--verify-harness-9-kịch-bản-judge)
6. [Bộ Đo Lường Benchmark Độc Lập (18 Held-Out Cases)](#6-bộ-đo-lường-benchmark-độc-lập-18-held-out-cases)
7. [Hướng Dẫn Cài Đặt & Khởi Chạy (Quickstart)](#7-hướng-dẫn-cài-đặt--khởi-chạy-quickstart)
8. [Tài Khoản Thử Nghiệm Mặc Định (Demo Accounts)](#8-tài-khoản-thử-nghiệm-mặc-định-demo-accounts)
9. [Bộ Kiểm Thử Cuộc Thi (Competition Test Suite - 21/21 Pass)](#9-bộ-kiểm-thử-cuộc-thi-competition-test-suite---2121-pass)
10. [Bằng Chứng Thử Nghiệm Người Dùng (User Validation Evidence)](#10-bằng-chứng-thử-nghiệm-người-dùng-user-validation-evidence)

---

## 1. MỤC TIÊU & BÀI TOÁN NGHIỆP VỤ CHUYÊN SÂU (NVQS DOMAIN)

Theo **Luật Nghĩa vụ quân sự Việt Nam** và Quy chế Quản lý đào tạo Đại học:
- Sinh viên theo học hệ chính quy được tạm hoãn gọi nhập ngũ trong thời gian một khóa đào tạo.
- Giấy xác nhận tạm hoãn NVQS chỉ được cấp gửi về **Ban Chỉ huy Quân sự cấp Quận/Huyện/Thị xã nơi sinh viên ĐĂNG KÝ THƯỜNG TRÚ**.
- **Tính chất nhạy cảm & nghiêm ngặt:** Cấp sai có thể dẫn đến trốn tránh nghĩa vụ quân sự trái phép hoặc tước đoạt quyền lợi học tập của công dân. Do đó, hệ thống không cho phép AI tự ý phê duyệt hồ sơ mơ hồ hoặc sai thẩm quyền.

Hệ thống tập trung toàn bộ năng lực vào một nghiệp vụ chuẩn mực duy nhất:
- **Tên danh mục nghiệp vụ:** `MILITARY_SERVICE_CONFIRMATION`
- **Cơ quan giải quyết:** Phòng Quản lý Đào tạo / Ban Chỉ huy Quân sự Nhà trường
- **Cơ chế:** Phê duyệt tự động (`AUTO_APPROVE`) các trường hợp chuẩn mực; Định tuyến phân xử (`ESCALATE_TO_HUMAN`) các tình huống nghi vấn, mâu thuẫn địa chỉ, ngoại lệ hoặc thiếu dữ kiện.

---

## 2. KIẾN TRÚC 3 LỚP DỮ KIỆN & QUY TẮC AN TOÀN AI

Để loại bỏ hoàn toàn hiện tượng AI "ảo giác" (hallucination) trong thẩm định hành chính, EDUASSISTANT phân tách rõ ràng 3 lớp dữ kiện:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 🏛️ LỚP 1: DỮ KIỆN THẨM QUYỀN NHÀ TRƯỜNG (Authoritative Institutional) │
│ • studentId, studentCode, fullName, academicStatus (ACTIVE/SUSPENDED)  │
│ • courseStartDate, courseEndDate, currentTermActive, hasCurrentSchedule │
│ • registeredPermanentAddress (Địa chỉ hộ khẩu thường trú gốc trong CSDL)│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Đối chiếu độc lập
┌───────────────────────────────────┴────────────────────────────────────┐
│ 📝 LỚP 2: TUYÊN BỐ CỦA SINH VIÊN (Student Claims)                      │
│ • declaredAddress: Địa chỉ sinh viên tự khai báo trong đơn             │
│ • addressType: PERMANENT (Thường trú) vs TEMPORARY (Tạm trú)           │
│ • requestReason: Lý do xin cấp / Bổ sung thông tin đợt khám NVQS       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Trích xuất cấu trúc & Chuẩn hoá
┌───────────────────────────────────┴────────────────────────────────────┐
│ 🤖 LỚP 3: DỮ KIỆN TRÍCH XUẤT AI (AI-Derived Facts)                     │
│ • parsed: {houseNumber, street, ward, district, province}              │
│ • normalized: Chuẩn hoá hành chính tiếng Việt đầy đủ cấp bậc           │
│ • missingFields: [], isComplete: bool, confidence: float [0..1]        │
│ • provenance: gemini-live / deterministic-administrative-cleaner       │
└────────────────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Quy Tắc An Toàn AI Cốt Lõi:**  
> Gemini VLM/LLM **TUYỆT ĐỐI KHÔNG** đưa ra khẳng định mang tính pháp lý (như "sinh viên được miễn NVQS" hay "hồ sơ đủ điều kiện pháp luật"). Gemini chỉ đóng vai trò phân tích cú pháp địa chỉ và bóc tách thành phần hành chính. Mọi quyết định chính sách đều do **Escalation Referee Engine** xác định theo luật.

---

## 3. CƠ CHẾ PHÂN XỬ LEO THANG (ESCALATION REFEREE 5 LÝ DO)

Bộ máy phân xử áp dụng quy tắc hình tháp thứ bậc (Hierarchical Cascade) với đầy đủ 5 lý do leo thang tiêu chuẩn của Hackathon:

| Thứ Bậc | Điều Kiện Kiểm Tra | Quyết Định | Lý Do Leo Thang | Trạng Thái Hồ Sơ |
| :---: | :--- | :---: | :---: | :---: |
| **1** | Sai lệch chủ quyền hồ sơ / Lệch MSSV tài khoản | `ESCALATE_TO_HUMAN` | `OWNERSHIP_UNCLEAR` | `UNDER_REVIEW` |
| **2** | Xin cứu xét ngoại lệ kéo dài quá thời hạn khóa học | `ESCALATE_TO_HUMAN` | `POLICY_OUT_OF_SCOPE` | `UNDER_REVIEW` |
| **3** | Tình trạng học vụ không hoạt động (`SUSPENDED`, `WITHDRAWN`) | `ESCALATE_TO_HUMAN` | `AUTHORITY_REQUIRED` | `UNDER_REVIEW` |
| **4** | Sinh viên chọn loại địa chỉ `TEMPORARY` (Tạm trú) | `ESCALATE_TO_HUMAN` | `DATA_CONFLICT` | `UNDER_REVIEW` |
| **5** | Địa chỉ thiếu Phường/Xã hoặc Tỉnh/TP hoặc độ tin cậy < Ngưỡng | `ESCALATE_TO_HUMAN` | `FACT_UNKNOWN` | `UNDER_REVIEW` |
| **6** | Xung đột thực chất địa chỉ (Lệch Tỉnh/TP, Quận/Huyện, Phường/Xã) | `ESCALATE_TO_HUMAN` | `DATA_CONFLICT` | `UNDER_REVIEW` |
| **7** | Cơ chế Fail-Safe khi AI ở chế độ `mock`, `cache`, hoặc `fallback` | `ESCALATE_TO_HUMAN` | `FACT_UNKNOWN` | `UNDER_REVIEW` |
| **8** | Đầy đủ dữ kiện, học vụ `ACTIVE`, địa chỉ thường trú trùng khớp | `AUTO_APPROVE` | *Không có* | `APPROVED` (Ký số HMAC) |

---

## 4. TÍNH BẤT BIẾN ĐỊNH DẠNG & NHẬN DIỆN XUNG ĐỘT THỰC CHẤT

Một hệ thống thông minh không được phép làm phiền cán bộ vì những khác biệt về cách gõ chữ:

### 4.1. Bất biến Định dạng (Tự động Duyệt - AUTO_APPROVE):
Hệ thống chuẩn hóa tự động và **KHÔNG LEO THANG THỪA** đối với:
- **Chữ HOA toàn bộ:** `"12/4 NGUYỄN ĐÌNH CHIỂU, PHƯỜNG ĐA KAO, QUẬN 1, TP. HỒ CHÍ MINH"`
- **Chữ thường toàn bộ:** `"12/4 nguyễn đình chiểu, phường đa kao, quận 1, tp. hồ chí minh"`
- **Viết tắt có chấm:** `"12/4 Nguyễn Đình Chiểu, P. Đa Kao, Q. 1, TP. HCM"`
- **Viết tắt không chấm:** `"12/4 nguyen dinh chieu, p da kao, q1, tphcm"`

### 4.2. Xung đột Thực chất (Bắt buộc Leo thang - ESCALATE_TO_HUMAN):
Khi hai địa chỉ đã đầy đủ thành phần hành chính nhưng khác biệt về mặt địa lý:
- Khác Tỉnh/Thành phố (`Hà Nội` vs `TP. Hồ Chí Minh`) -> `DATA_CONFLICT`
- Cùng Tỉnh nhưng khác Quận/Huyện (`Quận 1` vs `Quận 3`) -> `DATA_CONFLICT`
- Cùng Quận nhưng khác Phường/Xã (`Phường Đa Kao` vs `Phường Bến Nghé`) -> `DATA_CONFLICT`

---

## 5. CỔNG GIÁM KHẢO & VERIFY HARNESS 9 KỊCH BẢN (/judge)

Hệ thống tích hợp cổng Giám khảo trực quan tại **`/judge`** (`http://localhost:5173/judge`):
- Nhấn nút **"Chạy Verify Harness"** (`POST /api/verify/run`) để thực thi tức thì 9 kịch bản kiểm thử xác định in-memory:

| Mã Ca | Kịch Bản Nghiệp Vụ NVQS | Kết Quả Mong Đợi | Tỷ Lệ Đạt |
| :---: | :--- | :---: | :---: |
| `NVQS-01` | Hồ sơ NVQS hợp lệ tiêu chuẩn (Thường trú trùng khớp, Học vụ ACTIVE) | `AUTO_APPROVE` | 100% PASS |
| `NVQS-02` | Khác biệt định dạng: Toàn bộ chữ HOA & viết tắt chuẩn `P.`, `Q.`, `TP.` | `AUTO_APPROVE` | 100% PASS |
| `NVQS-03` | Khác biệt định dạng: Toàn bộ chữ thường không dấu & viết tắt `p`, `q1` | `AUTO_APPROVE` | 100% PASS |
| `NVQS-04` | Thiếu Phường/Xã trong địa chỉ khai báo | `ESCALATE_TO_HUMAN` (`FACT_UNKNOWN`) | 100% PASS |
| `NVQS-05` | Khai báo địa chỉ Tạm trú thay vì Thường trú theo quy định NVQS | `ESCALATE_TO_HUMAN` (`DATA_CONFLICT`) | 100% PASS |
| `NVQS-06` | Xung đột thực chất địa chỉ (Khai báo Quận 3 vs Hồ sơ Quận 1) | `ESCALATE_TO_HUMAN` (`DATA_CONFLICT`) | 100% PASS |
| `NVQS-07` | Sinh viên đang bị tạm đình chỉ học tập (`SUSPENDED`) | `ESCALATE_TO_HUMAN` (`AUTHORITY_REQUIRED`) | 100% PASS |
| `NVQS-08` | Đơn xin đặc cách hoãn NVQS vượt thời gian tối đa đào tạo | `ESCALATE_TO_HUMAN` (`POLICY_OUT_OF_SCOPE`) | 100% PASS |
| `NVQS-09` | Nghi vấn chủ quyền: Khai báo MSSV không thuộc về sinh viên | `ESCALATE_TO_HUMAN` (`OWNERSHIP_UNCLEAR`) | 100% PASS |

👉 **Kết quả thực tế:** **9/9 KỊCH BẢN PASS (100.0%)**

---

## 6. BỘ ĐO LƯỜNG BENCHMARK ĐỘC LẬP (18 HELD-OUT CASES)

Hệ thống kiểm chuẩn độc lập chạy bằng lệnh CLI không phụ thuộc CSDL:
```powershell
python EDUASSISTANT/benchmark/run_benchmark.py
```

### Kết Quả Đo Lường Toán Học Thực Tế:
```text
======================================================================
📊 KẾT QUẢ ĐO LƯỜNG CHUẨN XÁC (MEASUREMENT REPORT):
  • Decision Accuracy:            100.0% (18/18)
  • Automation Rate:              27.78% (5/18)
  • Escalation Rate:              72.22% (13/18)
  • Missed Escalation Rate:       0.0% (0/13)  <-- AN TOÀN TUYỆT ĐỐI
  • Unnecessary Escalation Rate:  0.0% (0/5)   <-- TỐI ƯU VẬN HÀNH
  • Thời gian chạy:               0.017s
======================================================================
```
*Kết quả chi tiết được tự động xuất ra `EDUASSISTANT/benchmark/results/latest.json` và `latest.csv`.*

---

## 7. HƯỚNG DẪN CÀI ĐẶT & KHỞI CHẠY (QUICKSTART)

### Khởi động Backend (Python FastAPI - Port 3001)
```powershell
cd EDUASSISTANT
python -m uvicorn backend.server:app --port 3001 --host 0.0.0.0 --reload
```
* API: `http://localhost:3001/api` | Swagger Docs: `http://localhost:3001/docs`

### Khởi động Frontend (React 19 + Vite - Port 5173)
```powershell
cd EDUASSISTANT/frontend
npm run dev
```
* Web App: `http://localhost:5173` | Cổng Giám Khảo: `http://localhost:5173/judge`

---

## 8. TÀI KHOẢN THỬ NGHIỆM MẶC ĐỊNH (DEMO ACCOUNTS)

| Vai Trò | Username | Password | Quyền Hạn & Tính Năng Nổi Bật |
| :--- | :--- | :--- | :--- |
| 🎓 **Sinh Viên** | `student1` | `password123` | Nộp đơn NVQS, xem dữ kiện học vụ, live preview chuẩn hóa địa chỉ AI, tra cứu mã QR. |
| 🔍 **Cán Bộ Đào Tạo** | `reviewer1` | `password123` | Hàng đợi thẩm định NVQS, thanh tra 3 lớp dữ kiện, Override (bắt buộc lý do), Dừng xử lý, gửi Reviewer Feedback. |
| 🛡️ **Quản Trị Viên** | `admin1` | `password123` | Bảng điều khiển KPI, giám sát Audit Trail (lưu `input` & `result`), chỉ số Benchmark. |

---

## 9. BỘ KIỂM THỬ CUỘC THI (COMPETITION TEST SUITE - 21/21 PASS)

Chạy bộ kiểm thử tự động toàn diện:
```powershell
python EDUASSISTANT/test/test_competition_features.py
```
**Kết quả: `21 PASSED | 0 FAILED (100% ĐẠT CHUẨN)`**
- ✅ Fail-Safe: Mock / Cache / Fallback chặn tự động duyệt (3/3 pass)
- ✅ Human Review: Override lý do, Stop, từ chối action lạ (3/3 pass)
- ✅ Workflow State Guard: Chặn thay đổi trạng thái từ terminal APPROVED (1/1 pass)
- ✅ Audit Trail: Lưu trữ và trả về đầy đủ `input` và `result` qua API (1/1 pass)
- ✅ Verify Harness: 9/9 kịch bản xác định đạt 100% pass (2/2 pass)
- ✅ Adaptive Threshold: Tăng +0.02, giảm -0.02, kẹp giới hạn `[0.65, 0.90]` (5/5 pass)
- ✅ Reviewer Feedback Endpoint: Chặn sinh viên 403, cho phép cán bộ 200 (2/2 pass)
- ✅ Benchmark Formulas: Decision Accuracy, Missed Escalation, Unnecessary Escalation (3/3 pass)

---

## 10. BẰNG CHỨNG THỬ NGHIỆM NGƯỜI DÙNG (USER VALIDATION EVIDENCE)

- **Quy trình & Biểu mẫu phỏng vấn:** Chi tiết tại `docs/user-validation/`
- **Mã Commit Gốc (Before):** `01f0fb94d724801db2e46231db4c2fb6b6d51081`
- **Báo cáo tổng hợp:** `docs/user-validation/summary-template.md`
- **User validation status:** PENDING. The repository currently contains templates and reserved folders for real participant evidence.

---
**EDUASSISTANT Team 1 - MLAI Hackathon 2026** — *The Escalation Referee & Human-in-the-Loop Safeguards for Military Service Deferment Verification.*
