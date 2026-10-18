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
7. [Verify Harness, Benchmark và Frozen Holdout](#7-verify-harness-benchmark-và-frozen-holdout)
8. [Bộ Kiểm Thử Toàn Diện](#8-bộ-kiểm-thử-toàn-diện)
9. [Final Preflight](#9-final-preflight)
10. [Xử Lý Sự Cố](#10-xử-lý-sự-cố-thường-gặp-troubleshooting)

---

## 1. Yêu Cầu Môi Trường
* **Python**: Phiên bản `>= 3.11`
* **Node.js**: Phiên bản `22` (giống CI)
* **NPM**: Phiên bản `>= 10`
* **Hệ cơ sở dữ liệu**: Neon PostgreSQL (`DATABASE_URL` dùng pooled connection string)
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

Tạo `EDUASSISTANT/.env` từ các giá trị phù hợp với môi trường. Trong Neon Console, chọn **Connect** và bật **Connection pooling** để lấy URL có hostname chứa `-pooler`. Dùng URL này cho `DATABASE_URL`:
```ini
APP_ENV=development
SEED_DEMO_DATA=true
PORT=3001
DATABASE_URL=postgresql://USER:PASSWORD@ep-example-pooler.region.aws.neon.tech/DATABASE?sslmode=require
# Optional for Alembic migrations: direct Neon URL without -pooler.
DIRECT_DATABASE_URL=postgresql://USER:PASSWORD@ep-example.region.aws.neon.tech/DATABASE?sslmode=require
DB_POOL_MIN_SIZE=1
DB_POOL_MAX_SIZE=10
DB_POOL_TIMEOUT_SECONDS=8
DB_POOL_MAX_IDLE_SECONDS=300
ALLOW_ADMIN_VERIFIED_DEMO_SIS=false
AI_MODE=live
GEMINI_API_KEY=your_gemini_api_key
JWT_SECRET=replace_with_a_random_secret
REFRESH_SECRET=replace_with_a_random_secret
SIGNATURE_KEY=replace_with_a_random_hmac_secret_at_least_32_characters
```

The application reuses up to 10 psycopg connections per backend process. Keep
the Neon pooled URL in `DATABASE_URL`; use `DIRECT_DATABASE_URL` only for
Alembic migrations. If the backend stays on Render, set the pooled URL in the
Render service environment. Changing a URL does not copy existing database data.

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

## 5. Tài Khoản Demo Công Khai / Local

These credentials are for explicitly seeded local demo accounts. Production uses `SEED_DEMO_DATA=false` and does not auto-seed accounts; the existing public competition database may already contain prepared accounts. Check live account availability before claiming these credentials work there.

| Vai trò | Tên đăng nhập | Mật khẩu | Quyền hạn chính |
| :--- | :--- | :--- | :--- |
| **SINH VIÊN** | `student1` | `password123` | Nộp hồ sơ, xem và bổ sung hồ sơ của mình, Student AI Agent, tra cứu HMAC theo quyền; không xem dữ kiện SIS chỉ dành cho Admin |
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

## 7. Verify Harness, Benchmark và Frozen Holdout

Fixed Synthetic Development Benchmark đo chính sách escalation trên 18 tình huống tổng hợp cố định. Đây không phải production validation hay frozen holdout:
```powershell
cd EDUASSISTANT
python benchmark/run_benchmark.py
```
Runner deterministic, không gọi Gemini/OpenRouter, không phụ thuộc network hoặc database. Kết quả được xuất tự động:
* `benchmark/results/latest.json`
* `benchmark/results/latest.csv`

Frozen Holdout là bộ riêng 36 tình huống tĩnh. Chạy thủ công sau khi hoàn tất thay đổi kỹ thuật:

```powershell
python benchmark/run_holdout_eval.py
```

Runner xác thực SHA-256 theo manifest trước khi gọi Rule Engine; nó không gọi AI, network, database và không đổi adaptive threshold. Không sửa v1 sau khi xem kết quả. Dataset không được đọc bởi runtime, routine CI, training hoặc unit tests và không được nhận là độc lập/được tác giả bên ngoài kiểm định.

Live AI E2E sanity check là lệnh riêng, tùy chọn; kết quả của nó không thay metric Track A:
```powershell
python benchmark/run_live_ai_eval.py
```

Production frontend: https://edu-sp.pages.dev · Judge: https://edu-sp.pages.dev/judge

Internal SIS registry contains demo data; no external university SIS connector exists. Production does not treat Admin-verified demo records as authoritative, and `ALLOW_ADMIN_VERIFIED_DEMO_SIS=false`. Deterministic evaluation uses explicitly synthetic test facts. `AUTO_APPROVE` describes internal processing only; it is not a military authority decision.

---

## 8. Bộ Kiểm Thử Toàn Diện (Security & Competition Suites)

### 8.1. Security integration suite

This legacy integration runner starts a local API and needs a disposable PostgreSQL
test database. Never point it at production or a shared database.
```powershell
cd EDUASSISTANT
python test/run_security_suite.py
```

### 8.2. Competition Readiness Suite

The suite starts FastAPI and checks real HTTP requests, database persistence,
Reviewer authorization, audits, threshold history, and concurrent feedback. It
refuses to run unless `DATABASE_URL` points to a local database ending in `_test`
and live AI keys are empty. GitHub Actions provisions an isolated `postgres:16`
service for this job.

```powershell
cd EDUASSISTANT
$env:APP_ENV = 'test'
$env:NODE_ENV = 'test'
$env:AI_MODE = 'mock'
$env:SEED_DEMO_DATA = 'true'
$env:ALLOW_ADMIN_VERIFIED_DEMO_SIS = 'false'
$env:DATABASE_URL = 'postgresql://postgres:local_test_only@127.0.0.1:5432/eduassistant_test'
$env:GEMINI_API_KEY = ''
$env:OPENROUTER_API_KEY = ''
python test/test_competition_features.py
```

The database in this command must be a dedicated disposable local test database.

**Observed status (2026-10-15):** code revision `a6bf907` passed all three
GitHub Actions jobs in run
[38686079502](https://github.com/LeDucThinh203/MLAI/actions/runs/38686079502),
including this PostgreSQL-backed integration suite and the frontend checks.
The local shell has no Python, Node.js, or npm, so local integration and
frontend commands were **NOT RUN**. Frozen Holdout is **NOT RUN**, and User
Validation is **PENDING**. See `docs/final/EVALUATION_EVIDENCE.md` for details.

## 9. Final Preflight

From `EDUASSISTANT/`, run:

```powershell
python scripts/final_preflight.py
```

This executes the critical backend test suite, Verify Harness, 18-case
development benchmark, benchmark provenance check, frontend lint and build,
and reports the frozen holdout artifact status and `User Validation: PENDING`.
It does not run the final holdout, call production APIs, deploy, or write to a
database.

---

## 10. Xử Lý Sự Cố Thường Gặp (Troubleshooting)

1. **Lỗi cổng 3001 bị chiếm dụng:**
   ```powershell
   Get-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess | Stop-Process -Force
   ```
2. **Khởi chạy kiểm tra kết nối Neon PostgreSQL:**
   Đảm bảo `DATABASE_URL` là pooled URL từ Neon Console (hostname có `-pooler`); đặt giá trị đó trong `.env` hoặc biến môi trường của backend host.
3. **Build Frontend kiểm tra lỗi:**
   ```powershell
   cd EDUASSISTANT/frontend
   npm run build
   ```
