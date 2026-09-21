# CaseFlow AI — The Escalation Referee

> **Automate the routine. Escalate the uncertain. Keep humans accountable.**
>
> MLAI Hackathon 2026 — Challenge A: **The Escalation Referee**

CaseFlow AI là hệ thống AI điều phối và xử lý các hồ sơ sinh viên bị mắc kẹt giữa nhiều bộ phận như Phòng Kế hoạch Tài chính, Phòng Đào tạo, Phòng Công tác Sinh viên và Phòng Công nghệ Thông tin.

Khác với chatbot chỉ trả lời hướng dẫn chung chung, CaseFlow AI sử dụng **Gemini Multimodal/VLM để trích xuất dữ kiện có cấu trúc từ minh chứng**, sau đó đưa dữ kiện qua các **deterministic rule engines** để quyết định hồ sơ có thể tự động xử lý hay phải chuyển cho con người. Các tình huống mơ hồ, xung đột dữ liệu, ngoài quy chế hoặc vượt thẩm quyền sẽ được dừng tự động hóa và chuyển sang **Human-in-the-Loop review**.

> [!IMPORTANT]
> Toàn bộ policy, dữ liệu sinh viên, biên lai, số tiền và tình huống trong repository là **SYNTHETIC HACKATHON DATA** phục vụ phát triển và kiểm thử. Đây không phải dữ liệu hoặc quy chế chính thức của bất kỳ trường đại học nào.

---

## 1. Bài toán

Một số tình huống CaseFlow AI hướng tới:

- Sinh viên đã thanh toán nhưng hệ thống vẫn hiển thị `UNPAID`.
- Số tiền trên biên lai khác số tiền hệ thống SIS ghi nhận.
- Minh chứng bị mờ hoặc thiếu mã giao dịch, mã sinh viên, số tiền.
- Hồ sơ bị chuyển qua lại giữa nhiều phòng ban và không rõ đơn vị chịu trách nhiệm.
- Yêu cầu nằm ngoài policy hiện hành.
- Giao dịch hoặc hành động vượt giới hạn AI được phép tự động xử lý.

Hệ thống phân loại các tình huống cần leo thang thành:

- `FACT_UNKNOWN`
- `DATA_CONFLICT`
- `POLICY_OUT_OF_SCOPE`
- `AUTHORITY_REQUIRED`
- `OWNERSHIP_UNCLEAR`

---

## 2. Kiến trúc xử lý

```text
Student / Officer
      |
      v
Create Case + Upload Evidence
      |
      v
File Validation + SHA-256 Storage
      |
      v
Gemini VLM / Text Extraction
      |
      v
Pydantic Structured Validation
      |
      v
Evidence Comparison
      |
      v
+-----------------------------+
| Deterministic Rule Engines  |
|                             |
|  UncertaintyEngine          |
|        -> PolicyEngine      |
|        -> AuthorityEngine   |
|        -> DecisionEngine    |
+-----------------------------+
      |
      +-------------------+
      |                   |
      v                   v
 AUTO_RESOLVE          ESCALATE
                          |
                          v
                  Human Review Portal
                          |
             Approve / Reject / Override /
                 Request Information
                          |
                          v
                    Audit Trail
```

### Nguyên tắc thiết kế

**Gemini không phải lớp ra quyết định policy cuối cùng.** AI/VLM được sử dụng chủ yếu để đọc ảnh/tài liệu, trích xuất dữ kiện và hỗ trợ giải thích. Quyết định nghiệp vụ được kiểm soát bởi rule engines và giới hạn thẩm quyền.

Khi dữ liệu không đủ chắc chắn, hệ thống ưu tiên **safe fallback** thay vì suy đoán. Hồ sơ có thể được chuyển sang human review kèm nguyên nhân, evidence và câu hỏi cụ thể cần cán bộ xác nhận.

Tài liệu kiến trúc chi tiết: [`caseflow-ai/docs/architecture/ARCHITECTURE.md`](caseflow-ai/docs/architecture/ARCHITECTURE.md)

---

## 3. Technology Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11+, FastAPI, Uvicorn |
| ORM / Migration | SQLAlchemy 2.x, Alembic |
| Database | Microsoft SQL Server 2022 |
| Database Driver | pyodbc + ODBC Driver 18 for SQL Server |
| Validation | Pydantic v2, pydantic-settings |
| AI / VLM | Google Gemini via `google-genai` |
| Default AI model | `gemini-2.5-flash` |
| Frontend | React 18, TypeScript, Vite 5 |
| Data fetching | TanStack Query, Axios |
| Forms / Validation | React Hook Form, Zod |
| UI | Tailwind CSS, Lucide React |
| Testing | pytest, pytest-asyncio, pytest-cov |
| Database container | Docker Compose + SQL Server 2022 Developer |

---

## 4. Repository Structure

```text
MLAI/
├── README.md
├── .vscode/
└── caseflow-ai/
    ├── .env.example
    ├── .gitignore
    ├── docker-compose.yml
    ├── start_all.bat
    │
    ├── backend/
    │   ├── alembic.ini
    │   ├── pyproject.toml
    │   ├── migrations/
    │   │   └── versions/
    │   │       └── 0001_initial_schema.py
    │   ├── app/
    │   │   ├── main.py
    │   │   ├── api/
    │   │   │   └── routes/
    │   │   ├── ai/
    │   │   │   ├── prompts/
    │   │   │   ├── text/
    │   │   │   └── vision/
    │   │   ├── core/
    │   │   ├── db/
    │   │   ├── models/
    │   │   ├── repositories/
    │   │   ├── rules/
    │   │   ├── schemas/
    │   │   └── services/
    │   └── tests/
    │       ├── unit/
    │       ├── integration/
    │       ├── verify/
    │       └── vlm/
    │
    ├── frontend/
    │   ├── package.json
    │   ├── vite.config.ts
    │   ├── tailwind.config.js
    │   └── src/
    │       ├── api/
    │       ├── components/
    │       ├── layouts/
    │       ├── pages/
    │       └── App.tsx
    │
    ├── docs/
    │   ├── architecture/
    │   ├── measurements/
    │   ├── policies/
    │   ├── runbook/
    │   └── user-testing/
    │
    ├── scripts/
    │   ├── generate_synthetic_evidence.py
    │   ├── test_end_to_end_decision.py
    │   ├── test_gemini_connection.py
    │   └── test_live_vlm.py
    │
    ├── storage/
    │   └── evidence/
    └── test-data/
        ├── evidence/
        └── sprint1/
```

---

## 5. Backend Modules

Backend được tách theo trách nhiệm:

- `api/routes/`: REST endpoints cho case, evidence, human review, policy, department, audit log và verification.
- `ai/vision/`: Gemini VLM xử lý ảnh/tài liệu.
- `ai/text/`: Gemini text provider.
- `ai/prompts/`: prompt templates phục vụ extraction và explanation.
- `rules/`: `UncertaintyEngine`, `PolicyEngine`, `AuthorityEngine`, `DecisionEngine`.
- `services/`: orchestration và business logic.
- `repositories/`: truy cập dữ liệu.
- `models/`: SQLAlchemy entities.
- `schemas/`: Pydantic request/response models.
- `db/`: session và synthetic seed data.

Các model chính gồm `Case`, `CaseMessage`, `Evidence`, `EvidenceExtraction`, `EvidenceComparison`, `CaseDecision`, `Escalation`, `HumanReview`, `AuditLog`, `Department`, `Policy`, `PolicyRule`, `VerificationRun`, `VerificationResult`.

---

## 6. Yêu cầu môi trường

Cài đặt trước:

- Git
- Python **3.11+**
- Node.js **18+** và npm
- Microsoft **ODBC Driver 18 for SQL Server**
- Docker Desktop nếu chạy SQL Server bằng Docker
- Gemini API key nếu muốn chạy VLM/LLM thật

Gemini API key không bắt buộc để backend khởi động. Khi không cấu hình key, AI provider có fallback/offline mode; tuy nhiên để demo khả năng đọc ảnh/tài liệu bằng Gemini VLM thật, cần khai báo `GEMINI_API_KEY`.

---

## 7. Clone Project

```bash
git clone https://github.com/LeDucThinh203/MLAI.git
cd MLAI/caseflow-ai
```

---

## 8. Cấu hình Backend Environment

Tạo `backend/.env` từ file mẫu.

### Windows PowerShell

```powershell
Copy-Item .env.example backend\.env
```

### Linux / macOS

```bash
cp .env.example backend/.env
```

Cấu hình khuyến nghị khi dùng SQL Server Docker:

```env
APP_ENV=development
APP_HOST=0.0.0.0
APP_PORT=8000
FRONTEND_URL=http://localhost:5173

GEMINI_API_KEY=
GEMINI_TEXT_MODEL=gemini-2.5-flash
GEMINI_VLM_MODEL=gemini-2.5-flash

DB_SERVER=localhost
DB_PORT=1433
DB_NAME=CaseFlowAI
DB_USER=sa
DB_PASSWORD=YourStrong@Passw0rd
DB_DRIVER=ODBC Driver 18 for SQL Server
DB_ENCRYPT=yes
DB_TRUST_SERVER_CERTIFICATE=yes
DB_TRUSTED_CONNECTION=no

EVIDENCE_STORAGE_PATH=storage/evidence
MAX_UPLOAD_MB=20
```

> [!IMPORTANT]
> Khi dùng SQL Server Docker với user `sa`, hãy đặt `DB_TRUSTED_CONNECTION=no`. Nếu để `yes`, backend sẽ sử dụng Windows Trusted Connection và không dùng `DB_USER` / `DB_PASSWORD`.

Không commit `backend/.env` hoặc Gemini API key lên GitHub.

---

## 9. Database — SQL Server 2022 bằng Docker

### 9.1. Khởi động SQL Server

Từ `caseflow-ai/`:

```bash
docker compose --env-file backend/.env up -d
```

Kiểm tra:

```bash
docker ps
```

Container mong đợi:

```text
caseflow-sqlserver
```

### 9.2. Tạo database `CaseFlowAI`

Docker Compose hiện chỉ khởi tạo SQL Server instance, chưa tự tạo database ứng dụng.

```bash
docker exec caseflow-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "YourStrong@Passw0rd" -C -Q "IF DB_ID('CaseFlowAI') IS NULL CREATE DATABASE CaseFlowAI;"
```

Thay password bằng đúng `DB_PASSWORD`.

### 9.3. Dừng database

```bash
docker compose --env-file backend/.env down
```

Xóa luôn Docker volume:

```bash
docker compose --env-file backend/.env down -v
```

> `down -v` sẽ xóa dữ liệu SQL Server trong volume.

---

## 10. Database — SQL Server cài trực tiếp trên Windows

Nếu sử dụng Windows Authentication:

```env
DB_SERVER=localhost\SQLEXPRESS
DB_NAME=CaseFlowAI
DB_DRIVER=ODBC Driver 18 for SQL Server
DB_ENCRYPT=yes
DB_TRUST_SERVER_CERTIFICATE=yes
DB_TRUSTED_CONNECTION=yes
```

Hoặc đổi `DB_SERVER` theo instance thực tế:

```env
DB_SERVER=MACHINE_NAME\SQL2025
```

Tạo database trước khi chạy migration:

```sql
IF DB_ID('CaseFlowAI') IS NULL
    CREATE DATABASE CaseFlowAI;
GO
```

Khi `DB_TRUSTED_CONNECTION=yes`, `DB_USER` và `DB_PASSWORD` không được sử dụng.

---

## 11. Cài đặt và chạy Backend

```bash
cd backend
python -m venv .venv
```

### Windows PowerShell

```powershell
.\.venv\Scripts\Activate.ps1
```

### Linux / macOS

```bash
source .venv/bin/activate
```

Cài dependencies:

```bash
python -m pip install --upgrade pip
pip install -e ".[dev]"
```

Chạy migration:

```bash
alembic upgrade head
```

Seed dữ liệu giả lập:

```bash
python -m app.db.seed
```

Khởi động backend:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Các địa chỉ:

```text
API          : http://localhost:8000
Health       : http://localhost:8000/health
Swagger UI   : http://localhost:8000/docs
ReDoc        : http://localhost:8000/redoc
```

---

## 12. Cấu hình và chạy Frontend

```bash
cd caseflow-ai/frontend
```

Tạo `.env`:

```powershell
Copy-Item .env.example .env
```

Nội dung:

```env
VITE_API_BASE_URL=http://localhost:8000
```

Cài package:

```bash
npm ci
npm run dev
```

Frontend:

```text
http://localhost:5173
```

Các route chính:

```text
/                       Home
/cases/new              Create case
/cases/:id              Case detail
/human-review           Human review queue
/human-review/:id       Review detail
/verify                 Verification harness
/policies               Policies
/audit-logs             Audit logs
```

---

## 13. Chạy nhanh trên Windows

Sau khi database và dependencies đã được chuẩn bị:

```powershell
.\start_all.bat
```

Script mở:

```text
Backend API Docs : http://localhost:8000/docs
Frontend Portal  : http://localhost:5173
```

`start_all.bat` không tự migrate hoặc khởi động SQL Server, nên database phải sẵn sàng trước.

---

## 14. API chính

Business API được mount dưới `/api`.

| Method | Endpoint | Mục đích |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/api/cases` | Tạo case |
| GET | `/api/cases` | Danh sách case |
| GET | `/api/cases/{id}` | Chi tiết case |
| POST | `/api/cases/{id}/analyze` | Phân tích case |
| POST | `/api/cases/{id}/stop` | Dừng workflow |
| POST | `/api/cases/{id}/resume` | Tiếp tục workflow |
| GET | `/api/cases/{id}/timeline` | Timeline |
| POST | `/api/cases/{id}/evidence` | Upload evidence |
| GET | `/api/cases/{id}/evidence` | Danh sách evidence |
| POST | `/api/evidence/{id}/analyze` | Phân tích evidence bằng AI/VLM |
| GET | `/api/human-review` | Danh sách escalation |
| POST | `/api/human-review/{id}/approve` | Approve |
| POST | `/api/human-review/{id}/reject` | Reject |
| POST | `/api/human-review/{id}/override` | Override |
| POST | `/api/human-review/{id}/request-information` | Yêu cầu bổ sung |
| GET | `/api/policies` | Danh sách policy |
| GET | `/api/departments` | Danh sách department |
| GET | `/api/audit-logs` | Audit logs |
| POST | `/api/verify/run` | Chạy verification suite |

Danh sách đầy đủ xem tại:

```text
http://localhost:8000/docs
```

---

## 15. Verification Harness

Dữ liệu kiểm thử:

```text
caseflow-ai/test-data/sprint1/
├── escalation_cases.json
├── independent_cases.json
├── verify_cases.json
└── vlm_cases.json
```

Chạy từ UI:

```text
http://localhost:5173/verify
```

Hoặc API:

```bash
curl -X POST http://localhost:8000/api/verify/run
```

Tạo 5 safeguard scenario mẫu:

```bash
curl -X POST http://localhost:8000/api/cases/seed-5-escalations
```

Các scenario đại diện cho:

- `FACT_UNKNOWN`
- `DATA_CONFLICT`
- `POLICY_OUT_OF_SCOPE`
- `OWNERSHIP_UNCLEAR`
- `AUTHORITY_REQUIRED`

---

## 16. Testing

Từ `caseflow-ai/backend`:

```bash
pytest
```

Coverage:

```bash
pytest --cov=app --cov-report=term-missing
```

Test structure:

```text
tests/
├── unit/
├── integration/
├── verify/
└── vlm/
```

Một số script:

```bash
python ../scripts/test_gemini_connection.py
python ../scripts/test_live_vlm.py
python ../scripts/test_end_to_end_decision.py
```

---

## 17. Gemini / VLM

Mặc định:

```env
GEMINI_TEXT_MODEL=gemini-2.5-flash
GEMINI_VLM_MODEL=gemini-2.5-flash
```

Bật Gemini thật:

```env
GEMINI_API_KEY=your_api_key_here
```

Không có API key thì provider chạy fallback/offline mode.

Kiểm tra Gemini:

```bash
python scripts/test_gemini_connection.py
```

---

## 18. Evidence Storage

```env
EVIDENCE_STORAGE_PATH=storage/evidence
MAX_UPLOAD_MB=20
```

Pipeline evidence thực hiện validation, lưu file, extraction và comparison trước khi rule engines ra quyết định.

Trong production nên thay local storage bằng object storage có access control, encryption, retention policy và malware scanning.

---

## 19. Synthetic Policy

Policy mẫu:

[`caseflow-ai/docs/policies/student_service_policy.md`](caseflow-ai/docs/policies/student_service_policy.md)

Seed tạo các department:

- `FINANCE`
- `ACADEMIC_AFFAIRS`
- `STUDENT_SERVICES`
- `IT_SUPPORT`

Policy học phí mẫu có rule `AUTO_RESOLVE` khi dữ liệu khớp và `ESCALATE` khi có xung đột. Policy cũng minh họa giới hạn thẩm quyền với giao dịch trên **50.000.000 VNĐ**.

---

## 20. Tài liệu bổ sung

- [System Architecture](caseflow-ai/docs/architecture/ARCHITECTURE.md)
- [Operational Runbook](caseflow-ai/docs/runbook/RUNBOOK.md)
- [Synthetic Student Service Policy](caseflow-ai/docs/policies/student_service_policy.md)
- [Measurement Plan](caseflow-ai/docs/measurements/MEASUREMENT_PLAN.md)
- [Application README](caseflow-ai/README.md)

---

## 21. Troubleshooting

### `Login failed for user 'sa'`

Kiểm tra password và:

```env
DB_TRUSTED_CONNECTION=no
```

### `Cannot open database "CaseFlowAI"`

Tạo database trước khi chạy:

```bash
alembic upgrade head
```

### Lỗi ODBC driver

Cài Microsoft ODBC Driver 18 for SQL Server và giữ:

```env
DB_DRIVER=ODBC Driver 18 for SQL Server
```

### CORS

Mặc định frontend là:

```env
FRONTEND_URL=http://localhost:5173
```

### Gemini không chạy

Kiểm tra `GEMINI_API_KEY` trong `backend/.env`.

### PowerShell chặn Activate.ps1

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

---

## 22. Development Notes

Khi thay đổi SQLAlchemy models:

```bash
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```

Frontend production build:

```bash
cd frontend
npm run build
```

Preview:

```bash
npm run preview
```

---

## 23. Project Status

CaseFlow AI hiện tập trung vào proof-of-concept cho MLAI Hackathon 2026:

- multimodal evidence extraction,
- deterministic safeguards,
- escalation workflow,
- human review,
- verification harness,
- auditability.

Các bước production hóa tiếp theo có thể gồm authentication/authorization, secrets management, object storage, real SIS/payment connectors, observability, rate limiting, stronger audit immutability, background jobs và CI/CD.

---

## License

Repository hiện chưa khai báo license riêng. Không mặc định xem source code là open-source cho đến khi project bổ sung file `LICENSE`.
