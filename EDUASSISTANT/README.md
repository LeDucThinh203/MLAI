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
- **SIS:** Registry nội bộ chứa dữ liệu demo; không có connector SIS đại học bên ngoài. Production không tin bản ghi `INTERNAL_DEMO_SIS` để `AUTO_APPROVE` (`ALLOW_ADMIN_VERIFIED_DEMO_SIS=false`); Admin portal hiện không có hành động xác nhận SIS demo.

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

Student Portal hỗ trợ tạo yêu cầu, theo dõi hồ sơ của chính sinh viên, bổ sung thông tin, comments và notifications. Student AI Agent cung cấp hướng dẫn RAG và OCR attachment PNG/JPEG/WebP/PDF tối đa 10 MB cùng chuẩn hóa địa chỉ. Agent chỉ dành cho Student, kiểm tra ownership và không cung cấp quyền đọc raw SIS; Reviewer/Admin không có Agent chat hoặc Agent tools.

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

| Mã Ca | Kịch Bản Nghiệp Vụ NVQS | Kết Quả Mong Đợi |
| :---: | :--- | :---: |
| `NVQS-01` | Hồ sơ xác nhận tình trạng sinh viên hợp lệ tiêu chuẩn | `AUTO_APPROVE` nội bộ |
| `NVQS-02` | Khác biệt định dạng: chữ hoa và viết tắt hành chính | `AUTO_APPROVE` nội bộ |
| `NVQS-03` | Khác biệt định dạng: chữ thường không dấu | `AUTO_APPROVE` nội bộ |
| `NVQS-04` | Thiếu Phường/Xã trong địa chỉ khai báo | `ESCALATE_TO_HUMAN` (`FACT_UNKNOWN`) |
| `NVQS-05` | Địa chỉ tạm trú được khai báo thay cho thường trú | `ESCALATE_TO_HUMAN` (`DATA_CONFLICT`) |
| `NVQS-06` | Xung đột thực chất giữa địa chỉ khai báo và dữ kiện lưu | `ESCALATE_TO_HUMAN` (`DATA_CONFLICT`) |
| `NVQS-07` | Tình trạng học tập cần cơ quan có thẩm quyền kiểm tra | `ESCALATE_TO_HUMAN` (`AUTHORITY_REQUIRED`) |
| `NVQS-08` | Yêu cầu ngoài phạm vi chính sách | `ESCALATE_TO_HUMAN` (`POLICY_OUT_OF_SCOPE`) |
| `NVQS-09` | MSSV không khớp chủ sở hữu | `ESCALATE_TO_HUMAN` (`OWNERSHIP_UNCLEAR`) |

Kết quả đạt/chưa đạt được trả về sau mỗi lần chạy trên `/judge`; bảng trên chỉ nêu kỳ vọng.

---

## 6. FIXED SYNTHETIC DEVELOPMENT BENCHMARK (18 KỊCH BẢN CỐ ĐỊNH)

Benchmark phát triển dùng fixed synthetic scenarios để đo quyết định escalation. Nó chạy không phụ thuộc database/network và không gọi AI. Đây không phải production validation hay bộ frozen holdout:
```powershell
python benchmark/run_benchmark.py
```

### Last recorded result — prior local benchmark run (2026-10-15 03:56:08 UTC)

This is a real recorded result from before the current holdout/preflight changes; the development benchmark has **not been re-run on this working tree**.
```text
======================================================================
📊 KẾT QUẢ ĐO LƯỜNG CHUẨN XÁC (MEASUREMENT REPORT):
  • Decision Accuracy:            100.0% (18/18)
  • Automation Rate:              27.78% (5/18)
  • Escalation Rate:              72.22% (13/18)
  • Missed Escalation Rate:       0.0% (0/13)
  • Unnecessary Escalation Rate:  0.0% (0/5)
  • Expected escalations:         13
  • Expected auto approvals:       5
  • AI calls performed:            false
======================================================================
```
*Kết quả chi tiết, SHA-256 của dataset, timestamp, case results và metrics được xuất ra `benchmark/results/latest.json` và `latest.csv`.*

## 6.1. FROZEN HOLDOUT — ĐÁNH GIÁ CUỐI RIÊNG BIỆT

Bộ `benchmark/holdout/track_a_holdout_v1.json` gồm 36 kịch bản tổng hợp, có expected labels viết tĩnh và SHA-256 đóng băng trong `manifest.json`. Bộ này tách khỏi benchmark phát triển 18 ca; không được đọc bởi runtime, CI, training hoặc unit tests. Dataset do nhóm dự án soạn và không được nhận là độc lập/được tác giả bên ngoài kiểm định.

Chỉ chạy thủ công sau khi hoàn tất thay đổi kỹ thuật:

```powershell
python benchmark/run_holdout_eval.py
```

Runner kiểm tra SHA trước khi đánh giá và ghi `benchmark/holdout/results/latest.json` cùng `.csv`. Không sửa v1 hoặc Rule Engine để làm đẹp kết quả; nếu cần chỉnh bộ dữ liệu, tạo version mới và ghi rõ lý do.

**Trạng thái hiện tại:** result file chưa tồn tại; chưa chạy trên working tree này.

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

These are credentials for explicitly seeded local demo accounts. The production configuration uses `SEED_DEMO_DATA=false` and does not auto-seed demo accounts; the existing public competition database may already contain prepared accounts. Live account availability must be checked against the live environment before claiming these credentials work there.

| Vai Trò | Username | Password | Quyền Hạn & Tính Năng Nổi Bật |
| :--- | :--- | :--- | :--- |
| 🎓 **Sinh Viên** | `student1` | `password123` | Nộp đơn, xem và bổ sung hồ sơ của mình, Student AI Agent, chuẩn hóa địa chỉ, tra cứu QR theo quyền. Không xem dữ kiện SIS chỉ dành cho Admin. |
| 🔍 **Cán Bộ Đào Tạo** | `reviewer1` | `password123` | Hàng đợi thẩm định NVQS, thanh tra 3 lớp dữ kiện, Override (bắt buộc lý do), Dừng xử lý, gửi Reviewer Feedback. |
| 🛡️ **Quản Trị Viên** | `admin1` | `password123` | Bảng điều khiển KPI, giám sát Audit Trail (lưu `input` & `result`), chỉ số Benchmark. |

---

## 9. COMPETITION TEST SUITE

Chạy bộ kiểm thử tự động toàn diện:
```powershell
python test/test_competition_features.py
```
This integration suite requires the PostgreSQL-backed application environment. The database-free CI regressions and deterministic checks run separately.

**Current readiness snapshot (2026-10-15):** GitHub Actions run [38683292907](https://github.com/LeDucThinh203/MLAI/actions/runs/38683292907) for baseline `3f80e484e8c1c4da6d720b983ffac019258b8c25` passed `backend-unit` and `frontend` but failed `competition-readiness`. Local fixes and added regressions are uncommitted and have not been rerun; CI is not green on the current changes. Python, Node.js, and npm checks are **NOT RUN** in this shell. Frozen Holdout is **NOT RUN** and User Validation is **PENDING**. See `docs/final/EVALUATION_EVIDENCE.md` for the evidence and its limits.

Chạy final local preflight bằng `python scripts/final_preflight.py`. Script chạy critical backend suite, Verify Harness, benchmark phát triển, kiểm tra provenance, frontend lint/build và báo trạng thái holdout; script không gọi production API, không tự chạy holdout và không deploy.

---

## 10. BẰNG CHỨNG THỬ NGHIỆM NGƯỜI DÙNG (USER VALIDATION EVIDENCE)

- **Quy trình và biểu mẫu:** `docs/user-validation/`
- **User validation status:** **PENDING** until real participants complete sessions.

---
Live AI sanity check là evaluation riêng, không thay thế metric Track A:
```powershell
python benchmark/run_live_ai_eval.py
```

Verify Harness: 9 deterministic cases · Development Benchmark: 18 fixed scenarios · Frozen Holdout: 36 fixed scenarios, metrics đọc từ result artifact · User validation: **PENDING** until real evidence exists.

**EDUASSISTANT Team 1 - MLAI Hackathon 2026** — Internal student-service confirmation workflow. HMAC-SHA256 is an integrity authentication token, not a PKI or legal digital signature.

## Student AI Agent

The authenticated Student AI Agent combines Gemini planning, OpenRouter fallback, allowlisted RAG over project policy and documentation, and student-scoped tools over existing application services. Reviewer and Admin accounts do not have Agent chat or Agent tools. The internal SIS registry is demo data; this feature does not add an external university SIS connector or make legal eligibility decisions.

Agent conversations are private to their student owner. Students may delete one conversation; its messages and pending Agent actions are deleted with it. Cases, SIS records, workflow audits, RAG knowledge, and account data remain. Student case reads are ownership-scoped. Data-changing tools show a preview and require explicit confirmation; the backend then rechecks the student's current role and live workflow state before calling existing business routes. Review transitions continue to use the workflow guard and Rule Engine behavior.

RAG indexing is lexical at startup and can optionally add Gemini embeddings when `GEMINI_EMBEDDING_MODEL` is configured. Admins can inspect `GET /api/admin/agent/rag/status` and request an index refresh with `POST /api/admin/agent/rag/reindex`. See `docs/architecture/ARCHITECTURE.md` for source allowlists and security boundaries. Provider API keys remain server-side.
