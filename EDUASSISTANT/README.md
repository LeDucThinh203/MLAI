# 🎖️ EDUASSISTANT - HỆ THỐNG THẨM ĐỊNH HỌC VỤ & CẤP GIẤY XÁC NHẬN TẠM HOÃN NGHĨA VỤ QUÂN SỰ
> **Đội Thi:** Team 1 | **Cuộc Thi:** MLAI Hackathon 2026 | **Track VNG – Option A:** The Escalation Referee & HITL  
> **Nghiệp Vụ Chuyên Sâu Duy Nhất:** Cấp Giấy Xác Nhận Sinh Viên Phục Vụ Tạm Hoãn Nghĩa Vụ Quân Sự (`MILITARY_SERVICE_CONFIRMATION`)  
> Phạm vi duy nhất: workflow nội bộ cấp giấy xác nhận sinh viên phục vụ hồ sơ tạm hoãn NVQS. Bộ phân loại escalation 5 nhóm là taxonomy do Team 1 triển khai. HMAC-SHA256 được dùng làm mã xác thực toàn vẹn, không phải chữ ký PKI hay chữ ký số có giá trị pháp lý.

**Live:** https://edu-sp.pages.dev · **Judge:** https://edu-sp.pages.dev/judge

---

## 📑 MỤC LỤC
1. [Mục Tiêu & Bài Toán Nghiệp Vụ Chuyên Sâu (NVQS Domain)](#1-mục-tiêu--bài-toán-nghiệp-vụ-chuyên-sâu-nvqs-domain)
2. [Kiến Trúc 3 Lớp Dữ Kiện & Quy Tắc An Toàn AI](#2-kiến-trúc-3-lớp-dữ-kiện--quy-tắc-an-toàn-ai)
3. [Cơ Chế Phân Xử Leo Thang (Escalation Referee 5 Lý Do)](#3-cơ-chế-phân-xử-leo-thang-escalation-referee-5-lý-do)
4. [Tính Bất Biến Định Dạng & Nhận Diện Xung Đột Thực Chất](#4-tính-bất-biến-định-dạng--nhận-diện-xung-đột-thực-chất)
5. [Cổng Giám Khảo & Verify Harness 9 Kịch Bản (/judge)](#5-cổng-giám-khảo--verify-harness-9-kịch-bản-judge)
6. [Track A Decision Benchmark (18 Kịch Bản Cố Định)](#6-track-a-decision-benchmark-18-kịch-bản-cố-định)
7. [Hướng Dẫn Cài Đặt & Khởi Chạy (Quickstart)](#7-hướng-dẫn-cài-đặt--khởi-chạy-quickstart)
8. [Tài Khoản Thử Nghiệm Mặc Định (Demo Accounts)](#8-tài-khoản-thử-nghiệm-mặc-định-demo-accounts)
9. [Competition Test Suite](#9-competition-test-suite)
10. [Bằng Chứng Thử Nghiệm Người Dùng (User Validation Evidence)](#10-bằng-chứng-thử-nghiệm-người-dùng-user-validation-evidence)

---

## 1. MỤC TIÊU & BÀI TOÁN NGHIỆP VỤ CHUYÊN SÂU (NVQS DOMAIN)

Đây là workflow nội bộ cấp giấy xác nhận sinh viên phục vụ hồ sơ tạm hoãn nghĩa vụ quân sự. README này mô tả hành vi phần mềm, không diễn giải điều kiện pháp luật và không thay thế hướng dẫn từ cơ quan có thẩm quyền.

Hệ thống tập trung toàn bộ năng lực vào một nghiệp vụ chuẩn mực duy nhất:
- **Tên danh mục nghiệp vụ:** `MILITARY_SERVICE_CONFIRMATION`
- **Workflow owner:** Internal reviewer or office configured by the institution
- **Cơ chế:** `AUTO_APPROVE` nghĩa là workflow nội bộ đủ điều kiện tự động xử lý; `ESCALATE_TO_HUMAN` chuyển hồ sơ cho cán bộ xem xét. Bản in là bản ghi workflow, không phải giấy xác nhận chính thức hoặc quyết định của cơ quan quân sự.
- **SIS:** Admin-managed internal demo registry; không có connector SIS đại học bên ngoài. Demo facts chỉ được trust khi Admin xác nhận rõ là dữ liệu demo.

---

## 2. KIẾN TRÚC 3 LỚP DỮ KIỆN & QUY TẮC AN TOÀN AI

Để giảm rủi ro AI tạo thông tin không có căn cứ, EDUASSISTANT phân tách rõ ràng 3 lớp dữ kiện:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 🏛️ LỚP 1: HỒ SƠ NỘI BỘ (Trust depends on source and verification)     │
│ • studentId, studentCode, fullName, academicStatus (ACTIVE/SUSPENDED)  │
│ • courseStartDate, courseEndDate, currentTermActive, hasCurrentSchedule │
│ • registeredPermanentAddress (địa chỉ lưu trong registry nội bộ)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Đối chiếu theo workflow
┌───────────────────────────────────┴────────────────────────────────────┐
│ 📝 LỚP 2: TUYÊN BỐ CỦA SINH VIÊN (Student Claims)                      │
│ • declaredAddress: Địa chỉ sinh viên tự khai báo trong đơn             │
│ • addressType: PERMANENT (Thường trú) vs TEMPORARY (Tạm trú)           │
│ • requestReason: Lý do và ghi chú do sinh viên cung cấp                 │
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
> Gemini được dùng để phân tích và chuẩn hóa địa chỉ; OpenRouter có thể chạy làm provider fallback khi được cấu hình. Rule Engine quyết định routing theo workflow nội bộ, không xác nhận tư cách pháp lý hay quyết định tạm hoãn NVQS. AI confidence là score do model tạo và chưa được hiệu chỉnh thống kê trên production dataset. Khi các provider không trả kết quả dùng được, address service dùng deterministic parser.

---

## 3. CƠ CHẾ PHÂN XỬ LEO THANG (ESCALATION REFEREE 5 LÝ DO)

Bộ máy dùng taxonomy 5 nhóm escalation do Team 1 triển khai; đây không phải danh sách tên category bắt buộc của Hackathon:

| Thứ Bậc | Điều Kiện Kiểm Tra | Quyết Định | Lý Do Leo Thang | Trạng Thái Hồ Sơ |
| :---: | :--- | :---: | :---: | :---: |
| **1** | Sai lệch chủ quyền hồ sơ / Lệch MSSV tài khoản | `ESCALATE_TO_HUMAN` | `OWNERSHIP_UNCLEAR` | `UNDER_REVIEW` |
| **2** | Xin cứu xét ngoại lệ kéo dài quá thời hạn khóa học | `ESCALATE_TO_HUMAN` | `POLICY_OUT_OF_SCOPE` | `UNDER_REVIEW` |
| **3** | Tình trạng học vụ không hoạt động (`SUSPENDED`, `WITHDRAWN`) | `ESCALATE_TO_HUMAN` | `AUTHORITY_REQUIRED` | `UNDER_REVIEW` |
| **4** | Sinh viên chọn loại địa chỉ `TEMPORARY` (Tạm trú) | `ESCALATE_TO_HUMAN` | `DATA_CONFLICT` | `UNDER_REVIEW` |
| **5** | Địa chỉ thiếu Phường/Xã hoặc Tỉnh/TP hoặc độ tin cậy < Ngưỡng | `ESCALATE_TO_HUMAN` | `FACT_UNKNOWN` | `UNDER_REVIEW` |
| **6** | Xung đột thực chất địa chỉ (Lệch Tỉnh/TP, Quận/Huyện, Phường/Xã) | `ESCALATE_TO_HUMAN` | `DATA_CONFLICT` | `UNDER_REVIEW` |
| **7** | Cơ chế Fail-Safe khi AI ở chế độ `mock`, `cache`, hoặc `fallback` | `ESCALATE_TO_HUMAN` | `FACT_UNKNOWN` | `UNDER_REVIEW` |
| **8** | Đủ các dữ kiện của workflow nội bộ và không phát hiện mâu thuẫn | `AUTO_APPROVE` | *Không có* | `APPROVED` (workflow nội bộ) |

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
| `NVQS-05` | Địa chỉ tạm trú được khai báo thay cho địa chỉ thường trú yêu cầu trong workflow | `ESCALATE_TO_HUMAN` (`DATA_CONFLICT`) | 100% PASS |
| `NVQS-06` | Xung đột thực chất địa chỉ (Khai báo Quận 3 vs Hồ sơ Quận 1) | `ESCALATE_TO_HUMAN` (`DATA_CONFLICT`) | 100% PASS |
| `NVQS-07` | Sinh viên đang bị tạm đình chỉ học tập (`SUSPENDED`) | `ESCALATE_TO_HUMAN` (`AUTHORITY_REQUIRED`) | 100% PASS |
| `NVQS-08` | Đơn xin đặc cách hoãn NVQS vượt thời gian tối đa đào tạo | `ESCALATE_TO_HUMAN` (`POLICY_OUT_OF_SCOPE`) | 100% PASS |
| `NVQS-09` | Nghi vấn chủ quyền: Khai báo MSSV không thuộc về sinh viên | `ESCALATE_TO_HUMAN` (`OWNERSHIP_UNCLEAR`) | 100% PASS |

👉 **Kết quả thực tế:** **9/9 KỊCH BẢN PASS (100.0%)**

---

## 6. TRACK A DECISION BENCHMARK (18 KỊCH BẢN CỐ ĐỊNH)

Benchmark chính dùng fixed synthetic scenarios để đo quyết định escalation. Nó chạy không phụ thuộc database/network và không gọi AI. Scenario set hiện tại chưa được mô tả là independent/held-out:
```powershell
python benchmark/run_benchmark.py
```

### Kết Quả Đo Lường Toán Học Thực Tế:
```text
======================================================================
📊 KẾT QUẢ ĐO LƯỜNG CHUẨN XÁC (MEASUREMENT REPORT):
  • Decision Accuracy:            100.0% (18/18)
  • Automation Rate:              27.78% (5/18)
  • Escalation Rate:              72.22% (13/18)
  • Missed Escalation Rate:       0.0% (0/13)
  • Unnecessary Escalation Rate:  0.0% (0/5)
  • Thời gian chạy lần gần nhất:  0.016s
======================================================================
```
*Kết quả chi tiết được tự động xuất ra `benchmark/results/latest.json` và `latest.csv`.*

---

## 7. HƯỚNG DẪN CÀI ĐẶT & KHỞI CHẠY (QUICKSTART)

### Khởi động Backend (Python FastAPI - Port 3001)
```powershell
python -m uvicorn backend.server:app --port 3001 --host 0.0.0.0 --reload
```
* API: `http://localhost:3001/api` | Swagger Docs: `http://localhost:3001/docs`

### Khởi động Frontend (React 19 + Vite - Port 5173)
```powershell
cd frontend
npm run dev
```
* Web App: `http://localhost:5173` | Cổng Giám Khảo: `http://localhost:5173/judge`

---

## 8. TÀI KHOẢN THỬ NGHIỆM MẶC ĐỊNH (DEMO ACCOUNTS)

Demo credentials are for local/demo use only. Accounts are seeded only when `SEED_DEMO_DATA=true`; production must set it to `false`.

| Vai Trò | Username | Password | Quyền Hạn & Tính Năng Nổi Bật |
| :--- | :--- | :--- | :--- |
| 🎓 **Sinh Viên** | `student1` | `password123` | Nộp đơn NVQS, xem dữ kiện học vụ, live preview chuẩn hóa địa chỉ AI, tra cứu mã QR. |
| 🔍 **Cán Bộ Đào Tạo** | `reviewer1` | `password123` | Hàng đợi thẩm định NVQS, thanh tra 3 lớp dữ kiện, Override (bắt buộc lý do), Dừng xử lý, gửi Reviewer Feedback. |
| 🛡️ **Quản Trị Viên** | `admin1` | `password123` | Bảng điều khiển KPI, giám sát Audit Trail (lưu `input` & `result`), chỉ số Benchmark. |

---

## 9. COMPETITION TEST SUITE

Chạy bộ kiểm thử tự động toàn diện:
```powershell
python test/test_competition_features.py
```
This integration suite requires the PostgreSQL-backed application environment. The database-free CI regressions and deterministic checks run separately.

---

## 10. BẰNG CHỨNG THỬ NGHIỆM NGƯỜI DÙNG (USER VALIDATION EVIDENCE)

- **Quy trình & Biểu mẫu phỏng vấn:** Chi tiết tại `docs/user-validation/`
- **Mã Commit Gốc (Before):** `01f0fb94d724801db2e46231db4c2fb6b6d51081`
- **Báo cáo tổng hợp:** `docs/user-validation/summary-template.md`
- **User validation status:** PENDING. The repository currently contains templates and reserved folders for real participant evidence.

---
Live AI sanity check là evaluation riêng, không thay thế metric Track A:
```powershell
python benchmark/run_live_ai_eval.py
```

Verify Harness: 9 deterministic cases · Track benchmark: 18 fixed scenarios · User validation: **PENDING** nếu chưa có evidence thật.

**EDUASSISTANT Team 1 - MLAI Hackathon 2026** — Internal student-service confirmation workflow. HMAC-SHA256 is an integrity authentication token, not a PKI or legal digital signature.

## Role-aware AI Agent

An authenticated chat assistant combines Gemini planning, OpenRouter fallback, allowlisted RAG over project policy and documentation, and role-scoped tools over existing application services. The internal SIS registry is demo data; this feature does not add an external university SIS connector or make legal eligibility decisions.

Agent conversations are private to their owner. Student case reads are ownership-scoped. Data-changing tools show a preview and require explicit confirmation; the backend then rechecks the user's current role and live workflow state before calling the existing business route. Review transitions continue to use the workflow guard and Rule Engine behavior.

RAG indexing is lexical at startup and can optionally add Gemini embeddings when `GEMINI_EMBEDDING_MODEL` is configured. Admins can inspect `GET /api/admin/agent/rag/status` and request an index refresh with `POST /api/admin/agent/rag/reindex`. See `docs/architecture/ARCHITECTURE.md` for source allowlists and security boundaries. Provider API keys remain server-side.
