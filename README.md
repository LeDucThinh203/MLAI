# CaseFlow AI

CaseFlow AI hỗ trợ xử lý hồ sơ sinh viên có minh chứng như biên lai, ảnh chụp SIS và PDF. Hệ thống chỉ tự động giải quyết khi dữ liệu rõ ràng, đúng quy chế và trong thẩm quyền; các trường hợp còn lại được chuyển đến cán bộ phù hợp kèm lý do cụ thể.

> Dữ liệu và minh chứng trong repository là dữ liệu giả lập phục vụ MLAI Hackathon 2026.

## Mục tiêu

- Giảm thời gian xử lý hồ sơ thường quy của sinh viên.
- Không để AI tự quyết khi thiếu dữ liệu, có mâu thuẫn hoặc vượt thẩm quyền.
- Lưu toàn bộ tiến trình để có thể kiểm tra lại từ lúc tạo hồ sơ đến khi hoàn tất.

## Luồng xử lý

```text
Tạo hồ sơ
  → Tải minh chứng
  → Gemini VLM trích xuất dữ kiện
  → Đối soát với dữ liệu SIS mô phỏng
  → Kiểm tra quy chế, độ tin cậy và thẩm quyền
  → Tự xử lý hoặc chuyển cán bộ
  → Ghi Audit Trail
```

Hệ thống chuyển cán bộ khi minh chứng mờ/thiếu, dữ liệu mâu thuẫn, tình huống ngoài quy chế, vượt hạn mức AI hoặc chưa rõ phòng ban phụ trách.

## Công nghệ

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: FastAPI, SQLAlchemy, Pydantic, Alembic
- Database: Microsoft SQL Server qua ODBC Driver 18
- AI: Google Gemini 2.5 Flash
- Kiểm thử: pytest và Verification Harness

## Cấu trúc thư mục

```text
MLAI/
├── README.md
└── caseflow-ai/
    ├── backend/            API, models, services, rule engine và migrations
    ├── frontend/           Giao diện React
    ├── docs/               Tài liệu kiến trúc và vận hành
    ├── test-data/sprint1/  Dữ liệu kiểm thử giả lập
    ├── storage/evidence/   Minh chứng mẫu cho local development
    └── start_all.bat       Chạy backend và frontend trên Windows
```

## Chạy SQL Server

Cần SQL Server cài trực tiếp trên máy và ODBC Driver 18 for SQL Server. Tạo database tên `CaseFlowAI`, sau đó cấu hình thông tin kết nối trong `caseflow-ai/backend/.env`.

## Chạy backend

```powershell
cd caseflow-ai/backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .
```

Tạo file `caseflow-ai/backend/.env`. Có hai cách kết nối phổ biến:

**Windows Authentication** — dùng tài khoản Windows đang đăng nhập. Ví dụ SQL Server chạy ở instance `SQLEXPRESS`:

```env
DB_SERVER=localhost\SQLEXPRESS
DB_PORT=
DB_NAME=CaseFlowAI
DB_DRIVER=ODBC Driver 18 for SQL Server
DB_TRUSTED_CONNECTION=yes
DB_TRUST_SERVER_CERTIFICATE=yes
DB_ENCRYPT=yes
GEMINI_API_KEY=
```

**SQL Server Authentication** — dùng tài khoản SQL Server, ví dụ instance mặc định ở cổng `1433`:

```env
DB_SERVER=localhost
DB_PORT=1433
DB_NAME=CaseFlowAI
DB_USER=sa
DB_PASSWORD=YourStrongPassword
DB_DRIVER=ODBC Driver 18 for SQL Server
DB_TRUSTED_CONNECTION=no
DB_TRUST_SERVER_CERTIFICATE=yes
DB_ENCRYPT=yes
GEMINI_API_KEY=
```

Chuỗi kết nối do ứng dụng tạo tương ứng là:

```text
# Windows Authentication
mssql+pyodbc://localhost\SQLEXPRESS/CaseFlowAI?driver=ODBC+Driver+18+for+SQL+Server&Trusted_Connection=yes&Encrypt=yes&TrustServerCertificate=yes

# SQL Server Authentication
mssql+pyodbc://sa:YourStrongPassword@localhost:1433/CaseFlowAI?driver=ODBC+Driver+18+for+SQL+Server&Encrypt=yes&TrustServerCertificate=yes
```

Không đặt `DB_USER` và `DB_PASSWORD` khi dùng Windows Authentication. Không commit file `.env` hoặc mật khẩu vào Git.

Sau đó chạy migration, dữ liệu mẫu và API:

```powershell
alembic upgrade head
python -m app.db.seed
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend chạy tại `http://localhost:8000`. API docs ở `http://localhost:8000/docs`.

## Chạy frontend

Mở một terminal khác:

```powershell
cd caseflow-ai/frontend
npm install
npm run dev
```

Mở `http://localhost:5173` để dùng ứng dụng.

Trên Windows, sau khi đã cài dependencies, có thể chạy `caseflow-ai/start_all.bat` để mở cả backend và frontend.

## Triển khai GitHub Pages

GitHub Pages chỉ triển khai frontend. Sau khi push lên `main`, workflow `.github/workflows/deploy-pages.yml` sẽ xuất bản giao diện tại `https://leducthinh203.github.io/MLAI/`.

Trước khi triển khai, vào **Settings → Secrets and variables → Actions → Variables** trên GitHub và tạo `VITE_API_BASE_URL` bằng URL HTTPS công khai của backend, ví dụ `https://caseflow-api.example.com`. Backend FastAPI và SQL Server phải chạy trên một dịch vụ hoặc máy chủ công khai riêng; GitHub Pages không chạy Python hay SQL Server.
