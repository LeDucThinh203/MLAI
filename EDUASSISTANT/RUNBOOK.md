# 📖 HƯỚNG DẪN VẬN HÀNH & KHỞI CHẠY HỆ THỐNG (RUNBOOK)
**Dự Án**: EDUASSISTANT – Hệ Thống Thẩm Định & Quản Lý Hồ Sơ Học Vụ Thông Minh  
**Đội Thi**: Team 1 (MLAI Hackathon 2026 - Track VNG – Option A: Escalation Referee)  
**Phiên Bản**: Current source (FastAPI + React/Vite + PostgreSQL; internal student-status workflow)

---

## 📌 MỤC LỤC
1. [Yêu Cầu Môi Trường](#1-yêu-cầu-môi-trường)
2. [Cài Đặt Thư Viện (Dependencies)](#2-cài-đặt-thư-viện-dependencies)
3. [Cấu Hình Biến Môi Trường (.env)](#3-cấu-hình-biến-môi-trường-env)
4. [Khởi Chạy Hệ Thống Thủ Công (2 Terminal)](#4-khởi-chạy-hệ-thống-thủ-công-2-terminal)
5. [Tài Khoản Thử Nghiệm Mặc Định](#5-tài-khoản-thử-nghiệm-mặc-định)
6. [Cổng Giám Khảo & Verify Harness (/judge)](#6-cổng-giám-khảo--verify-harness-judge)
7. [Verify Harness và Track A Benchmark](#7-verify-harness-và-track-a-benchmark)
8. [Bộ Kiểm Thử Toàn Diện (Security & Competition Suites)](#8-bộ-kiểm-thử-toàn-diện-security--competition-suites)
9. [Xử Lý Sự Cố Thường Gặp (Troubleshooting)](#9-xử-lý-sự-cố-thường-gặp-troubleshooting)

---

## 1. Yêu Cầu Môi Trường
* **Python**: Phiên bản `>= 3.11`
* **Node.js**: Phiên bản `>= 20.19`
* **NPM**: Phiên bản `>= 10`
* **Hệ cơ sở dữ liệu**: PostgreSQL 15/16 (`DATABASE_URL` required by the backend)
* **Cổng mạng (Ports)**:
  * Backend API: `3001`
  * Frontend Web: `5173`

Production serves the frontend from Cloudflare Pages and the API from the Python
backend service. `Dockerfile` builds the API container only; it does not package
or publish a second frontend.

---

## 2. Cài Đặt Thư Viện (Dependencies)

Mở terminal tại thư mục `EDUASSISTANT/`:

### Bước 2.1: Cài đặt thư viện Backend Python
```powershell
python -m pip install -r requirements.txt
```

### Bước 2.2: Cài đặt thư viện Frontend
```powershell
cd frontend
npm ci
cd ..
```

---

## 3. Cấu Hình Biến Môi Trường (.env)

Tạo `EDUASSISTANT/.env` từ các giá trị phù hợp với môi trường. Local development cần PostgreSQL:
```ini
APP_ENV=development
SEED_DEMO_DATA=true
PORT=3001
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/eduassistant_db
ALLOW_ADMIN_VERIFIED_DEMO_SIS=true
AI_MODE=live
GEMINI_API_KEY=your_gemini_api_key
JWT_SECRET=replace_with_a_random_secret
REFRESH_SECRET=replace_with_a_random_secret
SIGNATURE_KEY=replace_with_a_random_hmac_secret_at_least_32_characters
```

Demo accounts are seeded only when `SEED_DEMO_DATA=true`; set it to `false` in production. Keep secrets private. In production set `APP_ENV=production` and
`ALLOW_ADMIN_VERIFIED_DEMO_SIS=false`. No Admin AI Mode selector exists; provider
configuration is environment-based. Gemini is used when configured; OCR fallback
does not invent document fields.

The optional authenticated Student AI Agent is available only to `STUDENT` accounts and uses `AGENT_ENABLED=true`, `AGENT_MAX_TOOL_STEPS=4`,
`AGENT_RAG_TOP_K=5`, `AGENT_HISTORY_MESSAGES=12`, `AGENT_ACTION_TTL_SECONDS=300`,
and `AGENT_MAX_MESSAGE_CHARS=6000`. It reuses `GEMINI_API_KEY` as the primary planner
and `OPENROUTER_API_KEY` as fallback. `GEMINI_EMBEDDING_MODEL` is optional; without
it, the knowledge index uses lexical retrieval. The Agent indexes only the allowlisted
policy and project documentation described in `docs/architecture/ARCHITECTURE.md`.

After startup, an empty RAG index is populated locally without an embedding API call.
An Admin can inspect it at `GET /api/admin/agent/rag/status` and explicitly enrich or
rebuild it with `POST /api/admin/agent/rag/reindex`; these are RAG maintenance endpoints and do not grant Admin Agent chat or tools. Agent writes are first stored as
short-lived pending actions and are not applied until the user selects **Xác nhận**.
Expired, cancelled, stale, or role-changed actions cannot be executed.

---

## 4. Khởi Chạy Hệ Thống Thủ Công (2 Terminal)

### Terminal 1: Khởi động Backend Python FastAPI
```powershell
cd EDUASSISTANT
python -m uvicorn backend.server:app --port 3001 --host 0.0.0.0 --reload
```
*API Base URL:* `http://localhost:3001/api`  
*Swagger Documentation:* `http://localhost:3001/docs`

### Terminal 2: Khởi động Frontend React Vite
```powershell
cd EDUASSISTANT/frontend
npm run dev
```
*Giao diện người dùng:* `http://localhost:5173`

---

## 5. Tài Khoản Thử Nghiệm Mặc Định

| Vai trò | Tên đăng nhập | Mật khẩu | Quyền hạn chính |
| :--- | :--- | :--- | :--- |
| **SINH VIÊN** | `student1` | `password123` | Nộp hồ sơ nội bộ, tải minh chứng, theo dõi workflow, tra cứu HMAC |
| **THẨM ĐỊNH VIÊN** | `reviewer1` | `password123` | Thẩm định, Duyệt, Từ chối, Yêu cầu bổ sung, Override, Dừng, Feedback |
| **QUẢN TRỊ VIÊN** | `admin1` | `password123` | Quản lý registry SIS demo, chính sách read-only, Audit Trail và dữ liệu vận hành |

---

## 6. Cổng Giám Khảo & Verify Harness (/judge)

Truy cập trực tiếp: `http://localhost:5173/judge` (hoặc nhấp **Cổng Giám Khảo** trên thanh điều hướng).  
Cho phép:
- Xem tóm tắt nhanh dự án và kiến trúc Escalation Referee.
- Bấm **"Chạy Verify Harness"** (`POST /api/verify/run`) để chạy 9 scenario deterministic in-memory; endpoint không gọi network hoặc ghi database.
- Chuyển hướng nhanh đến Cổng Thẩm định, Nhật ký Kiểm toán, và Cổng Quản trị.

---

## 7. Verify Harness và Track A Benchmark

Track A Decision Benchmark đo escalation policy trên 18 fixed synthetic scenarios. Đây không phải dữ liệu production hoặc independent/held-out dataset:
```powershell
cd EDUASSISTANT
python benchmark/run_benchmark.py
```
Runner deterministic, không gọi Gemini/OpenRouter, không phụ thuộc network hoặc database. Kết quả được xuất tự động:
* `benchmark/results/latest.json`
* `benchmark/results/latest.csv`

Live AI E2E sanity check là lệnh riêng, tùy chọn; kết quả của nó không thay metric Track A:
```powershell
python benchmark/run_live_ai_eval.py
```

Production frontend: https://edu-sp.pages.dev · Judge: https://edu-sp.pages.dev/judge

Internal SIS registry không kết nối SIS đại học bên ngoài. “Admin Verified – Demo” chỉ xác nhận facts nội bộ cho workflow demo. `AUTO_APPROVE` chỉ mô tả xử lý nội bộ, không phải quyết định tạm hoãn của cơ quan quân sự.

---

## 8. Bộ Kiểm Thử Toàn Diện (Security & Competition Suites)

### 8.1. Security integration suite

This legacy integration runner starts a local API and needs a reachable PostgreSQL
database through `DATABASE_URL`. It was not run in the current database-free test
environment.
```powershell
cd EDUASSISTANT
python test/run_security_suite.py
```

### 8.2. Competition Features Suite (21 assertions)
```powershell
cd EDUASSISTANT
python test/test_competition_features.py
```

---

## 9. Xử Lý Sự Cố Thường Gặp (Troubleshooting)

1. **Lỗi cổng 3001 bị chiếm dụng:**
   ```powershell
   Get-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess | Stop-Process -Force
   ```
2. **Khởi chạy kiểm tra kết nối Render PostgreSQL:**
   Đảm bảo cấu hình biến môi trường `DATABASE_URL=postgresql://...` chính xác từ Render Dashboard.
3. **Build Frontend kiểm tra lỗi:**
   ```powershell
   cd EDUASSISTANT/frontend
   npm run build
   ```
