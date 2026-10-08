# 🎓 EDUASSISTANT - HỆ THỐNG THẨM ĐỊNH & QUẢN LÝ HỒ SƠ HỌC VỤ THÔNG MINH
> **Đội Thi:** Team 1 | **Cuộc Thi:** MLAI Hackathon 2026 | **Track VNG – Option A:** Escalation Referee  
> Nền tảng thẩm định hồ sơ học vụ thông minh kết hợp **AI Multimodal OCR (Google Gemini)**, **Bộ máy Quy tắc Nghiệp vụ (Rule Engine 5 Lý do Leo thang)**, **Cơ sở dữ liệu Doanh nghiệp Microsoft SQL Server 2025 (Hỗ trợ SQLite WAL dự phòng)**, **Bảo mật Đa lớp (JWT, Bcrypt, 2FA TOTP, Chống IDOR)**, **Xác thực Số QR (HMAC-SHA256)**, **Adaptive Escalation Threshold** và **Hệ Thống Kiểm Chuẩn Xác Định (Verify Harness & Benchmark)**.

---

## 📑 MỤC LỤC
1. [Tổng Quan Kiến Trúc Hệ Thống](#1-tổng-quan-kiến-trúc-hệ-thống)
2. [Cấu Trúc Thư Mục Dự Án (Project Structure)](#2-cấu-trúc-thư-mục-dự-án-project-structure)
3. [Cơ Chế Escalation Referee & Fail-Safe An Toàn](#3-cơ-chế-escalation-referee--fail-safe-an-toàn)
4. [Hướng Dẫn Cài Đặt & Khởi Chạy (How to Run)](#4-hướng-dẫn-cài-đặt--khởi-chạy-how-to-run)
5. [Tài Khoản Thử Nghiệm Mặc Định (Demo Accounts)](#5-tài-khoản-thử-nghiệm-mặc-định-demo-accounts)
6. [Cổng Giám Khảo & Verify Harness (/judge)](#6-cổng-giám-khảo--verify-harness-judge)
7. [Tài Liệu API & Swagger Documentation](#7-tài-liệu-api--swagger-documentation)
8. [Bộ Kiểm Chuẩn Benchmark Đo Lường Độc Lập](#8-bộ-kiểm-chuẩn-benchmark-đo-lường-độc-lập)
9. [Kiểm Thử Toàn Diện (Security & Competition Suites)](#9-kiểm-thử-toàn-diện-security--competition-suites)
10. [Bằng Chứng Thử Nghiệm Người Dùng (User Validation)](#10-bằng-chứng-thử-nghiệm-người-dùng-user-validation)

---

## 1. TỔNG QUAN KIẾN TRÚC HỆ THỐNG

EDUASSISTANT được xây dựng theo kiến trúc hiện đại, tách biệt hoàn toàn giữa Frontend và Backend:

```
┌────────────────────────────────────────────────────────┐
│             FRONTEND CLIENT (React 19 + Vite)          │
│                http://localhost:5173                   │
│   • Sinh viên: Nộp đơn, tải minh chứng, tra cứu QR     │
│   • Thẩm định viên: Đối chiếu hồ sơ, duyệt ký số, HITL  │
│   • Quản trị viên: Phân quyền, Audit Trail, Metrics    │
│   • Giám khảo: /judge (One-click Verify Harness)       │
└───────────────────────────┬────────────────────────────┘
                            │ REST API (JSON / Multipart)
                            ▼
┌────────────────────────────────────────────────────────┐
│           BACKEND ENGINE (Python 3.10+ FastAPI)        │
│                http://localhost:3001/api               │
│   • Authentication: JWT + Refresh Rotation + 2FA TOTP   │
│   • Escalation Referee: 5 lý do leo thang nghiệp vụ    │
│   • AI Engine: Gemini VLM OCR (Single source of truth) │
│   • Adaptive Threshold: [0.65, 0.90] từ Human Feedback │
│   • Verify Harness: /api/verify/run (Deterministic)    │
│   • Bảo vệ: Quét Magic-bytes, chống IDOR, ký HMAC      │
└───────────────────────────┬────────────────────────────┘
                            │ SQLAlchemy 2.0 ORM / pyodbc
                            ▼
┌────────────────────────────────────────────────────────┐
│           DATABASE: MICROSOFT SQL SERVER 2025          │
│              Server: THINH\SQL2025 | DB: CaseFlowAI    │
│   • users, cases, audits, comments, notifications...   │
│   • (Hỗ trợ tự động fallback SQLite khi chạy Test)     │
└────────────────────────────────────────────────────────┘
```

---

## 2. CẤU TRÚC THƯ MỤC DỰ ÁN (PROJECT STRUCTURE)

```text
MLAI/
├── EDUASSISTANT/                        # Thư mục mã nguồn chính của hệ thống
│   ├── backend/                         # Máy chủ Backend Python FastAPI (Port 3001)
│   │   ├── app/
│   │   │   ├── config.py                # Quản lý cấu hình môi trường (.env), bí mật bảo mật & DB
│   │   │   ├── main.py                  # Khởi tạo FastAPI app, CORS, Request Logger, Routers
│   │   │   ├── core/
│   │   │   │   ├── dependencies.py      # Dependency injection xác thực người dùng (get_current_user)
│   │   │   │   ├── responses.py         # Chuẩn hoá định dạng phản hồi API JSON
│   │   │   │   └── security.py          # Hàm băm mật khẩu Bcrypt & mã hóa
│   │   │   ├── db/
│   │   │   │   ├── database.py          # Quản lý kết nối SQL Server 2025 & SQLite fallback
│   │   │   │   ├── db.py                # DatabaseService tầng nghiệp vụ CRUD dữ liệu
│   │   │   │   └── caseflow.sqlite      # CSDL SQLite dự phòng
│   │   │   ├── models/                  # SQLAlchemy ORM Models (User, Case, Audit...)
│   │   │   ├── routers/                 # Các API Router theo nghiệp vụ:
│   │   │   │   ├── auth.py              # Xác thực, Đăng nhập, Đăng ký, Đổi mật khẩu
│   │   │   │   ├── two_factor.py        # 2FA TOTP (Google Authenticator)
│   │   │   │   ├── cases.py             # Quản lý hồ sơ, Thẩm định HITL, Reviewer Feedback
│   │   │   │   ├── evidence.py          # Tải lên minh chứng & quét OCR
│   │   │   │   ├── audits.py            # Nhật ký kiểm toán thời gian thực (lưu input & result)
│   │   │   │   ├── verify.py            # Verify Harness endpoint (/api/verify/run)
│   │   │   │   └── admin.py             # Quản trị hệ thống & chỉ số đo lường
│   │   │   └── services/                # Các dịch vụ lõi:
│   │   │       ├── ai_service.py        # Gemini VLM AI (Single source of truth get_ai_mode)
│   │   │       ├── ocr_service.py       # OCR trích xuất dữ kiện minh chứng
│   │   │       ├── rule_engine.py       # Bộ máy quy tắc & Fail-Safe Non-Live AI
│   │   │       ├── escalation_policy_service.py # Ngưỡng tin cậy thích ứng (Adaptive Threshold)
│   │   │       ├── workflow_guard.py    # Bảo vệ trạng thái chuyển luồng công việc
│   │   │       └── verify_harness_service.py # 6 ca kiểm chuẩn xác định cho Giám khảo
│   ├── frontend/                        # Ứng dụng Web React 19 + Vite (Port 5173)
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── student/             # Cổng Sinh Viên (Nộp đơn, Tra cứu QR)
│   │   │   │   ├── reviewer/            # Cổng Thẩm Định Viên (Hàng đợi, Override, Stop, Feedback)
│   │   │   │   ├── admin/               # Cổng Quản Trị Viên (KPI, Benchmark Metrics, User Mgmt)
│   │   │   │   ├── judge/               # Cổng Giám Khảo (/judge - Verify Harness)
│   │   │   │   └── public/              # Trang xác thực công khai QR
│   ├── benchmark/                       # Bộ kiểm chuẩn đo lường độc lập
│   │   ├── held_out_cases.json          # 10 ca kiểm thử độc lập (không bias)
│   │   ├── run_benchmark.py             # Script tính toán các chỉ số toán học chuẩn
│   │   └── results/                     # Kết quả xuất ra latest.json và latest.csv
│   └── test/                            # Bộ kiểm thử tự động
│       ├── run_security_suite.py        # 40 bài kiểm thử bảo mật & phân quyền
│       └── test_competition_features.py # 21 bài kiểm thử tiêu chuẩn cuộc thi
└── docs/
    └── user-validation/                 # Khung thu thập bằng chứng kiểm thử người dùng thật
```

---

## 3. CƠ CHẾ ESCALATION REFEREE & FAIL-SAFE AN TOÀN

EDUASSISTANT triển khai bộ máy **Escalation Referee** tuân thủ nguyên tắc: **AI không quyết định chính sách**, dữ kiện trích xuất từ minh chứng thật (`factual_ocr`) được ưu tiên tuyệt đối so với văn bản AI tự sinh:

1. **5 Lý do Leo thang Nghiệp vụ:**
   - `FACT_UNKNOWN`: Dữ kiện chưa rõ, ảnh mờ, độ tin cậy < threshold, hoặc thiếu minh chứng.
   - `DATA_CONFLICT`: Mâu thuẫn giữa loại đơn khai báo và nội dung minh chứng thực tế.
   - `AUTHORITY_REQUIRED`: Hồ sơ vượt thẩm quyền tự động (Ưu tiên Cao, Phúc khảo điểm, Học bổng).
   - `POLICY_OUT_OF_SCOPE`: Hồ sơ xin cứu xét ngoại lệ hoặc thuộc danh mục chung (GENERAL).
   - `OWNERSHIP_UNCLEAR`: Tên hoặc MSSV trên tài liệu không trùng khớp với tài khoản sinh viên.
2. **Fail-Safe Non-Live AI:**
   Khi hệ thống chạy ở chế độ `mock`, `cache`, hoặc xảy ra `fallback`: Hệ thống **tuyệt đối không cho phép AUTO_APPROVE**, mà bắt buộc chuyển sang `ESCALATE_TO_HUMAN` với lý do `FACT_UNKNOWN` và trạng thái `UNDER_REVIEW`.
3. **Adaptive Escalation Threshold:**
   Ngưỡng tin cậy mặc định là `0.75` (giới hạn an toàn `[0.65, 0.90]`). Khi Thẩm định viên gửi phản hồi:
   - `MISSED_ESCALATION`: Ngưỡng tăng +0.02 (thắt chặt an toàn).
   - `UNNECESSARY_ESCALATION`: Ngưỡng giảm -0.02 (giảm tải cán bộ).
   - `CORRECT`: Giữ nguyên.
4. **Human-in-the-Loop Actions:**
   Hỗ trợ 5 hành động rõ ràng: `APPROVE`, `REJECT`, `REQUEST_INFO`, `OVERRIDE` (bắt buộc nhập lý do đặc cách và lưu khuyến nghị cũ), và `STOP` (dừng tiến trình tự động).

---

## 4. HƯỚNG DẪN CÀI ĐẶT & KHỞI CHẠY (HOW TO RUN)

### Bước 1: Khởi động Backend (Python FastAPI)
```powershell
cd EDUASSISTANT
python -m uvicorn backend.server:app --port 3001 --host 0.0.0.0 --reload
```
* Backend API: `http://localhost:3001/api`
* Swagger UI: `http://localhost:3001/docs`

### Bước 2: Khởi động Frontend (React 19 Vite)
```powershell
cd EDUASSISTANT/frontend
npm install
npm run dev
```
* Giao diện người dùng: `http://localhost:5173`

---

## 5. TÀI KHOẢN THỬ NGHIỆM MẶC ĐỊNH (DEMO ACCOUNTS)

| Vai Trò | Tên Đăng Nhập | Mật Khẩu | Quyền Hạn & Tính Năng |
| :--- | :--- | :--- | :--- |
| 🎓 **Sinh Viên** | `student1` | `password123` | Nộp hồ sơ học vụ, tải minh chứng, theo dõi tiến trình, tra cứu QR. |
| 🔍 **Thẩm Định Viên** | `reviewer1` | `password123` | Hàng đợi 3 cột, đối chiếu Rule Engine, Override, Dừng, Gửi Feedback. |
| 🛡️ **Quản Trị Viên** | `admin1` | `password123` | Bảng điều khiển KPI, đổi AI Mode, giám sát Audit Trail, chỉ số Benchmark. |

---

## 6. CỔNG GIÁM KHẢO & VERIFY HARNESS (/judge)

Hệ thống trang bị riêng tuyến đường **`/judge`** (`http://localhost:5173/judge`) để Hội đồng Giám khảo có thể:
1. Xem tóm tắt thông tin dự án Team 1 & Track VNG - Escalation Referee.
2. Nhấn nút **"Chạy Verify Harness"** (`POST /api/verify/run`) để thực thi 6 ca kiểm thử xác định in-memory:
   - Ca 1: Routine Valid Case -> Kỳ vọng: `AUTO_APPROVE` (PASS)
   - Ca 2: FACT_UNKNOWN Case -> Kỳ vọng: `ESCALATE_TO_HUMAN` (PASS)
   - Ca 3: DATA_CONFLICT Case -> Kỳ vọng: `ESCALATE_TO_HUMAN` (PASS)
   - Ca 4: AUTHORITY_REQUIRED Case -> Kỳ vọng: `ESCALATE_TO_HUMAN` (PASS)
   - Ca 5: POLICY_OUT_OF_SCOPE Case -> Kỳ vọng: `ESCALATE_TO_HUMAN` (PASS)
   - Ca 6: OWNERSHIP_UNCLEAR Case -> Kỳ vọng: `ESCALATE_TO_HUMAN` (PASS)
3. Chuyển hướng một chạm sang Cổng Thẩm Định, Cổng Quản Trị và Nhật Ký Kiểm Toán.

---

## 7. TÀI LIỆU API & SWAGGER DOCUMENTATION

Tài liệu API tương tác trực quan: **`http://localhost:3001/docs`**

### Các endpoint quan trọng:
* **`POST /api/verify/run`**: Thực thi Verify Harness kiểm chuẩn xác định 6 ca nghiệp vụ.
* **`POST /api/cases/{case_id}/feedback`**: Tiếp nhận phản hồi từ Reviewer (`CORRECT`, `MISSED_ESCALATION`, `UNNECESSARY_ESCALATION`) và tự động thích ứng ngưỡng.
* **`POST /api/cases/{case_id}/review`**: Xử lý thẩm định con người (`APPROVE`, `REJECT`, `REQUEST_INFO`, `OVERRIDE`, `STOP`).
* **`GET /api/cases/verify/{case_id}`**: Tra cứu công khai tính hợp lệ của chữ ký số qua mã QR.
* **`GET /api/audits`**: Lấy nhật ký kiểm toán (lưu trữ đầy đủ cả `input` lẫn `result`).
* **`GET /api/admin/metrics`**: Báo cáo chỉ số vận hành, ngưỡng hiện tại, và kết quả benchmark.

---

## 8. BỘ KIỂM CHUẨN BENCHMARK ĐO LƯỜNG ĐỘC LẬP

EDUASSISTANT cung cấp công cụ Benchmark thực thi độc lập:
```powershell
cd EDUASSISTANT
python benchmark/run_benchmark.py
```
* **Chỉ số đo lường toán học:**
  - `Decision Accuracy` = Đúng / Tổng số ca
  - `Automation Rate` = Tự động duyệt / Tổng số ca
  - `Escalation Rate` = Leo thang / Tổng số ca
  - `Missed Escalation Rate` = Bỏ sót leo thang / Tổng số ca cần leo thang *(Mục tiêu: 0.00%)*
  - `Unnecessary Escalation Rate` = Leo thang thừa / Tổng số ca cần tự động duyệt *(Mục tiêu: 0.00%)*
* Kết quả tự động ghi vào `benchmark/results/latest.json` và `latest.csv`.

---

## 9. KIỂM THỬ TOÀN DIỆN (SECURITY & COMPETITION SUITES)

### 9.1. Kiểm thử 40 Tiêu chí Bảo mật (Security Suite)
```powershell
cd EDUASSISTANT
python test/run_security_suite.py
```
* **Kết quả:** `40 PASSED | 0 FAILED (100% ĐẠT CHUẨN)`

### 9.2. Kiểm thử 15 Tiêu chuẩn Cuộc thi (Competition Features Suite)
```powershell
cd EDUASSISTANT
python test/test_competition_features.py
```
* **Kết quả:** `21 PASSED | 0 FAILED (100% ĐẠT CHUẨN)`  
Bao gồm: Chặn auto-approve khi mock/cache/fallback, từ chối review action lạ, bắt buộc lý do override, audit HUMAN_OVERRIDE, chặn status transition trái phép, persist audit input & result, Verify Harness 100% pass, Adaptive Threshold tăng/giảm/kẹp bounds, phân quyền RBAC feedback, và công thức benchmark chuẩn xác.

---

## 10. BẰNG CHỨNG THỬ NGHIỆM NGƯỜI DÙNG (USER VALIDATION)

Để đảm bảo tính khách quan và minh bạch (tuyệt đối không bịa đặt số liệu hoặc người dùng giả), nhóm cung cấp khung tài liệu hướng dẫn và biểu mẫu tại:
* **`docs/user-validation/README.md`**: Hướng dẫn quy trình phỏng vấn thử nghiệm thực tế với >=3 người dùng thật.
* **`docs/user-validation/feedback-template.md`**: Biểu mẫu ghi chép phản hồi nguyên văn (verbatim), điểm nghẽn (pain points), và yêu cầu cải tiến sản phẩm.
* **`docs/user-validation/summary-template.md`**: Báo cáo tổng hợp bằng chứng kiểm thử người dùng cho Sprint 2.

---
**EDUASSISTANT Platform v3.0** — Hệ thống Sẵn sàng Thi đấu & Vận hành Doanh nghiệp (MLAI Hackathon 2026).
