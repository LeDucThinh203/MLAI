# CaseFlow AI

CaseFlow AI xử lý hồ sơ sinh viên có minh chứng như biên lai, ảnh chụp SIS và PDF. Hệ thống chỉ tự động giải quyết khi dữ liệu rõ ràng, đúng quy chế và trong thẩm quyền; các trường hợp còn lại được chuyển đến đúng cán bộ với lý do cụ thể.

> Dữ liệu, quy chế và minh chứng trong dự án là dữ liệu giả lập cho MLAI Hackathon 2026. Không dùng cho hồ sơ thật.

## Luồng xử lý

```text
Tạo hồ sơ → Tải minh chứng → Trích xuất VLM → Đối soát dữ liệu SIS
→ Kiểm tra quy chế, độ tin cậy, thẩm quyền → Tự xử lý hoặc leo thang → Audit Trail
```

| Hệ thống dừng khi | Mã | Ví dụ |
| --- | --- | --- |
| Minh chứng thiếu hoặc mờ | `FACT_UNKNOWN` | Không đọc được số tiền hoặc mã giao dịch |
| Dữ liệu không khớp | `DATA_CONFLICT` | Biên lai và SIS ghi khác số tiền |
| Ngoài quy chế | `POLICY_OUT_OF_SCOPE` | Đặc cách chưa có rule tự động |
| Vượt thẩm quyền AI | `AUTHORITY_REQUIRED` | Giao dịch trên 50 triệu VNĐ |
| Chưa rõ đơn vị xử lý | `OWNERSHIP_UNCLEAR` | Hai phòng cùng từ chối tiếp nhận |

## Công nghệ

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: FastAPI, SQLAlchemy, Pydantic, Alembic
- Database: Microsoft SQL Server qua ODBC Driver 18
- AI: Google Gemini 2.5 Flash
- Kiểm thử: pytest và Verification Harness

## Cấu trúc thư mục

```text
caseflow-ai/
├── backend/            API FastAPI, models, services, rule engine, migrations
├── frontend/           Giao diện React
├── docs/               Runbook, kiến trúc, quy chế và kế hoạch đo lường
├── test-data/sprint1/  Dữ liệu kiểm thử giả lập
├── storage/evidence/   Minh chứng mẫu cho local development
├── docker-compose.yml  SQL Server dùng với Docker
└── start_all.bat       Chạy backend và frontend trên Windows
```

## Yêu cầu

- Python 3.11 trở lên
- Node.js 18 trở lên
- SQL Server 2022 hoặc Docker Desktop
- ODBC Driver 18 for SQL Server
- Gemini API key nếu muốn dùng trích xuất VLM thật

## Chạy dự án trên Windows

### 1. Chuẩn bị database

Tại thư mục `caseflow-ai`:

```powershell
docker compose up -d
```

Hoặc dùng SQL Server local và tạo database `CaseFlowAI`.

### 2. Cấu hình và chạy backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .
```

Tạo file `backend/.env`. Ví dụ cho SQL Server local bằng Windows Authentication:

```env
DB_SERVER=localhost
DB_NAME=CaseFlowAI
DB_DRIVER=ODBC Driver 18 for SQL Server
DB_TRUSTED_CONNECTION=yes
DB_TRUST_SERVER_CERTIFICATE=yes
GEMINI_API_KEY=
```

Nếu dùng tài khoản SQL Server, đặt `DB_TRUSTED_CONNECTION=no`, rồi thêm `DB_USER` và `DB_PASSWORD`.

Áp dụng schema và dữ liệu mẫu:

```powershell
alembic upgrade head
python -m app.db.seed
```

Chạy API:

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API: `http://localhost:8000` · Swagger: `http://localhost:8000/docs`

### 3. Chạy frontend

Mở terminal khác:

```powershell
cd frontend
npm install
npm run dev
```

Mở `http://localhost:5173`.

Sau khi đã cài dependencies, có thể chạy `start_all.bat` ở thư mục `caseflow-ai` để mở cả backend và frontend.

## Kiểm thử

Backend:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q
```

Kiểm tra mã hóa tiếng Việt và lưu Unicode:

```powershell
.\.venv\Scripts\python.exe scripts/check_unicode.py
```

Build frontend:

```powershell
cd frontend
npm run build
```

Trang `/verify` cũng có thể chạy toàn bộ fixture trong `test-data/sprint1` qua Decision Engine thực tế.

## Lỗi tiếng Việt thành dấu `?`

Sau khi cập nhật code hoặc database, chạy:

```powershell
cd backend
alembic upgrade head
.\.venv\Scripts\python.exe scripts/check_unicode.py
```

Nếu dữ liệu cũ đã lỗi, xem trước bản sửa:

```powershell
.\.venv\Scripts\python.exe scripts/repair_unicode.py
```

Chỉ khi danh sách xem trước đúng, áp dụng sửa dữ liệu:

```powershell
.\.venv\Scripts\python.exe scripts/repair_unicode.py --apply
```

Lệnh tạo bản sao trước khi sửa tại `backend/storage/unicode-backups/`; thư mục này không được commit.

## API chính

| Phương thức | Đường dẫn | Mục đích |
| --- | --- | --- |
| `POST` | `/api/cases` | Tạo hồ sơ |
| `GET` | `/api/cases/{id}` | Xem chi tiết hồ sơ |
| `POST` | `/api/cases/{id}/analyze` | Chạy VLM và Decision Engine |
| `POST` | `/api/cases/{id}/evidence` | Tải minh chứng |
| `GET` | `/api/human-review` | Hồ sơ chờ cán bộ |
| `GET` | `/api/audit-logs` | Nhật ký kiểm toán |
| `POST` | `/api/verify/run` | Chạy Verification Harness |
| `GET` | `/health` | Kiểm tra API và database |

## Quy ước Git

- `main`: phiên bản ổn định.
- `develop`: nhánh tích hợp trước khi đưa vào `main`.
- `refactor/frontend-component-extraction`: tách component từ các trang React lớn.
- `refactor/backend-service-boundaries`: làm rõ ranh giới service và repository.
- `test/quality-gates`: tăng kiểm thử, lint và kiểm tra build.

Tạo nhánh tính năng từ `develop`:

```powershell
git checkout develop
git pull
git checkout -b feat/ten-chuc-nang
```

Trước khi tạo pull request, chạy backend tests và frontend build.

## Tài liệu thêm

- [Runbook](docs/runbook/RUNBOOK.md)
- [Architecture](docs/architecture/ARCHITECTURE.md)
- [Synthetic policy](docs/policies/student_service_policy.md)
- [Measurement plan](docs/measurements/MEASUREMENT_PLAN.md)
