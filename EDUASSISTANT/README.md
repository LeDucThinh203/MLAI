# 🎓 EDUASSISTANT - HỆ THỐNG THẨM ĐỊNH & QUẢN LÝ HỒ SƠ HỌC VỤ THÔNG MINH

> Nền tảng thẩm định hồ sơ học vụ thông minh kết hợp **AI Multimodal OCR (Google Gemini)**, **Bộ máy Quy tắc Nghiệp vụ (Rule Engine 5 Cấp Độ)**, **Cơ sở dữ liệu Doanh nghiệp Microsoft SQL Server 2025**, **Bảo mật Đa lớp (JWT, Bcrypt, 2FA TOTP, Chống IDOR)** và **Ký số Điện tử Xác thực QR (HMAC-SHA256)**.

---

## 📑 MỤC LỤC
1. [Tổng Quan Kiến Trúc Hệ Thống](#1-tổng-quan-kiến-trúc-hệ-thống)
2. [Cấu Trúc Thư Mục Dự Án (Project Structure)](#2-cấu-trúc-thư-mục-dự-án-project-structure)
3. [Cấu Hình Cơ Sở Dữ Liệu & Chuỗi Kết Nối (Database Configuration)](#3-cấu-hình-cơ-sở-dữ-liệu--chuỗi-kết-nối-database-configuration)
4. [Hướng Dẫn Cài Đặt & Khởi Chạy (How to Run)](#4-hướng-dẫn-cài-đặt--khởi-chạy-how-to-run)
5. [Tài Khoản Thử Nghiệm Mặc Định (Demo Accounts)](#5-tài-khoản-thử-nghiệm-mặc-định-demo-accounts)
6. [Tài Liệu API & Swagger Documentation](#6-tài-liệu-api--swagger-documentation)
7. [Kiểm Thử Bảo Mật & Toàn Vẹn (Automated Test Suite)](#7-kiểm-thử-bảo-mật--toàn-vẹn-automated-test-suite)

---

## 1. TỔNG QUAN KIẾN TRÚC HỆ THỐNG

EduAssistant được xây dựng theo kiến trúc hiện đại, tách biệt hoàn toàn giữa Frontend và Backend:

```
┌────────────────────────────────────────────────────────┐
│             FRONTEND CLIENT (React 19 + Vite)          │
│                http://localhost:5173                   │
│   • Sinh viên: Nộp đơn, tải minh chứng, tra cứu QR     │
│   • Thẩm định viên: Đối chiếu hồ sơ, duyệt ký số       │
│   • Quản trị viên: Phân quyền, giám sát Audit Trail    │
└───────────────────────────┬────────────────────────────┘
                            │ REST API (JSON / Multipart)
                            ▼
┌────────────────────────────────────────────────────────┐
│           BACKEND ENGINE (Python 3.10+ FastAPI)        │
│                http://localhost:3001/api               │
│   • Authentication: JWT + Refresh Rotation + 2FA TOTP   │
│   • Rule Engine: Tự động phát hiện 5 lý do leo thang   │
│   • AI Engine: Gemini 2.5 VLM OCR + Trích xuất dữ liệu │
│   • Bảo vệ: Quét Magic-bytes, chống IDOR, ký HMAC      │
└───────────────────────────┬────────────────────────────┘
                            │ ODBC Driver 18 (pyodbc)
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
│   │   │   │   ├── database.py          # Quản lý kết nối SQL Server 2025 (pyodbc) & SQLite WAL mode
│   │   │   │   ├── db.py                # DatabaseService tầng nghiệp vụ CRUD dữ liệu
│   │   │   │   ├── data.json            # Dữ liệu hạt giống (Seed data) ban đầu
│   │   │   │   └── caseflow.sqlite      # CSDL SQLite dự phòng
│   │   │   ├── routers/                 # Các API Router theo nghiệp vụ:
│   │   │   │   ├── auth.py              # Đăng nhập, đăng ký, 2FA TOTP, Refresh Token, Profile
│   │   │   │   ├── cases.py             # Nộp đơn, xem đơn, duyệt đơn, xuất PDF, ký số, QR
│   │   │   │   ├── evidence.py          # Upload minh chứng, kiểm tra Magic Bytes, phục vụ ảnh
│   │   │   │   ├── audits.py            # Xem nhật ký kiểm toán phân quyền & xuất CSV
│   │   │   │   ├── admin.py             # Quản lý tài khoản người dùng, đổi quyền, KPI
│   │   │   │   ├── ai.py                # Trạng thái AI Engine & chế độ hoạt động (live/mock)
│   │   │   │   ├── notifications.py     # Quản lý thông báo sinh viên & cán bộ
│   │   │   │   └── health.py            # Kiểm tra trạng thái hệ thống và kết nối DB
│   │   │   ├── schemas/                 # Pydantic Schemas xác thực dữ liệu đầu vào
│   │   │   │   ├── auth.py
│   │   │   │   ├── cases.py
│   │   │   │   └── admin.py
│   │   │   └── services/                # Các dịch vụ xử lý logic chuyên sâu:
│   │   │       ├── ai_service.py        # Tích hợp Google Gemini VLM OCR (Fail-safe)
│   │   │       ├── ocr_service.py       # Trích xuất văn bản từ hình ảnh minh chứng
│   │   │       ├── rule_engine.py       # Ma trận 5 lý do leo thang thẩm định tự động
│   │   │       ├── report_service.py    # Sinh mẫu quyết định công văn & báo cáo HTML
│   │   │       └── upload_service.py    # Kiểm định Magic-bytes chống tệp giả mạo & mã độc
│   │   └── server.py                    # File khởi động chính máy chủ Backend Python
│   │
│   ├── frontend/                        # Ứng dụng Giao diện Web (React 19 + Vite - Port 5173)
│   │   ├── src/
│   │   │   ├── App.jsx                  # Toàn bộ giao diện người dùng hợp nhất (Sinh viên, Thẩm định, Admin)
│   │   │   ├── App.css                  # Thiết kế giao diện hiện đại, Dark/Light Mode, Glassmorphism
│   │   │   ├── index.css                # Typography & Base styles
│   │   │   └── main.jsx                 # Điểm gắn kết React DOM
│   │   ├── index.html                   # Trang chủ HTML
│   │   ├── vite.config.js               # Cấu hình Vite dev server
│   │   └── package.json                 # Thư viện Frontend
│   │
│   ├── test/                            # Bộ kiểm thử tự động toàn diện
│   │   ├── run_security_suite.py        # Runner khởi chạy test cô lập tự động
│   │   └── security_and_system_test.py  # 40 bài kiểm thử bảo mật IDOR, JWT, 2FA, VLM
│   │
│   ├── scripts/                         # Kịch bản hỗ trợ
│   │   ├── create_evidence.py           # Sinh ảnh minh chứng mẫu để test
│   │   └── seed_full_demo.py            # Nạp dữ liệu mô phỏng
│   │
│   ├── uploads/                         # Nơi lưu trữ tệp minh chứng an toàn
│   ├── .env                             # File biến môi trường (chứa cấu hình SQL Server)
│   ├── .env.example                     # Mẫu biến môi trường mẫu
│   ├── Dockerfile                       # Container hóa ứng dụng
│   ├── docker-compose.yml               # Triển khai đồng thời Backend & Frontend
│   ├── requirements.txt                 # Danh sách thư viện Python
│   ├── package.json                     # Thông tin gói dự án
│   ├── start_all.bat                    # Script khởi chạy Backend + Frontend tự động
│   └── Run.bat                          # Script 1-Click mở cả app và tự động bật trình duyệt
│
├── Run.bat                              # Shortcut 1-Click chạy toàn bộ dự án từ thư mục gốc
├── start_all.bat                        # Shortcut khởi động Backend và Frontend từ thư mục gốc
├── pyrightconfig.json                   # Cấu hình phân tích kiểu dữ liệu Python IDE (0 lỗi)
└── README.md                            # Tài liệu hướng dẫn dự án (File này)
```

---

## 3. CẤU HÌNH CƠ SỞ DỮ LIỆU & CHUỖI KẾT NỐI (DATABASE CONFIGURATION)

Hệ thống được thiết lập cơ chế **Dual Engine** linh hoạt: mặc định sử dụng **Microsoft SQL Server 2025**, đồng thời tự động hỗ trợ **SQLite** làm môi trường dự phòng an toàn.

File cấu hình đặt tại: **`EDUASSISTANT/.env`** (được tự động đọc khi khởi động).

### 3.1. Cấu hình Microsoft SQL Server (Mặc định doanh nghiệp):
```ini
# Loại CSDL: mssql | sqlite
DB_TYPE=mssql

# Tên SQL Server Instance (Theo ảnh màn hình SSMS của bạn)
DB_SERVER=THINH\SQL2025

# Tên Cơ sở dữ liệu trong SQL Server
DB_NAME=CaseFlowAI

# Cổng mặc định
DB_PORT=1433

# Sử dụng Windows Authentication (khuyến nghị trên máy tính cá nhân):
DB_TRUSTED_CONNECTION=yes

# Driver ODBC (Hệ thống hỗ trợ Driver 18, 17 và SQL Server Native Client)
DB_DRIVER=ODBC Driver 18 for SQL Server

# Tin cậy chứng chỉ máy chủ & Mã hóa dữ liệu
DB_TRUST_SERVER_CERTIFICATE=yes
DB_ENCRYPT=yes

# (Tùy chọn) Nếu dùng tài khoản sa hoặc SQL Server Authentication:
# DB_TRUSTED_CONNECTION=no
# DB_USER=sa
# DB_PASSWORD=YourPassword123
```

### 3.2. Cấu hình SQLite (Dự phòng / Chạy kiểm thử độc lập):
Nếu bạn muốn chạy hệ thống hoàn toàn độc lập mà không cần bật dịch vụ SQL Server:
```ini
DB_TYPE=sqlite
```
Dữ liệu sẽ tự động lưu trữ tại file SQLite: `EDUASSISTANT/backend/app/db/caseflow.sqlite`.

---

## 4. HƯỚNG DẪN CÀI ĐẶT & KHỞI CHẠY (HOW TO RUN)

### Yêu cầu môi trường tối thiểu:
1. **Python 3.10+**: Đã cài đặt và có trong PATH (`python --version`).
2. **Node.js 18+ & npm**: Để chạy Frontend (`node -v`).
3. **Microsoft SQL Server 2022/2025**: Đang ở trạng thái `Running` (Service `MSSQL$SQL2025`).

---

### Cách 1: Khởi Chạy Nhanh 1-Click (Khuyến nghị cho Windows)
Tại thư mục gốc dự án, bạn chỉ cần nhấp đúp chuột vào:
* **`Run.bat`**: Tự động cài đặt dependencies nếu thiếu, khởi động Backend (port 3001), khởi động Frontend (port 5173), đợi 3 giây và tự động mở trình duyệt tại `http://localhost:5173`.
* Hoặc chạy: **`start_all.bat`**.

---

### Cách 2: Khởi Chạy Thủ Công Từng Phần (Manual Run)

#### Bước 1: Khởi động Backend (Python FastAPI)
Mở một cửa sổ Terminal (PowerShell hoặc CMD):
```powershell
# Di chuyển vào thư mục backend
cd EDUASSISTANT/backend

# Khởi chạy server
python server.py
```
* **Kết quả:** Server khởi động tại `http://localhost:3001`
* **Log thành công:**
  ```text
  [Database] Microsoft SQL Server kết nối thành công: THINH\SQL2025 -> CSDL [CaseFlowAI]
  Uvicorn running on http://0.0.0.0:3001
  ```

#### Bước 2: Khởi động Frontend (React 19 Vite)
Mở một cửa sổ Terminal thứ hai:
```powershell
# Di chuyển vào thư mục frontend
cd EDUASSISTANT/frontend

# Cài đặt dependencies (chỉ cần chạy lần đầu)
npm install

# Khởi chạy dev server
npm run dev
```
* **Kết quả:** Giao diện sẵn sàng tại `http://localhost:5173`.

---

## 5. TÀI KHOẢN THỬ NGHIỆM MẶC ĐỊNH (DEMO ACCOUNTS)

Hệ thống đã nạp sẵn các tài khoản mẫu đầy đủ dữ liệu trong cơ sở dữ liệu:

| Vai Trò | Tên Đăng Nhập | Mật Khẩu | Họ Và Tên | Quyền Hạn & Tính Năng |
| :--- | :--- | :--- | :--- | :--- |
| 🎓 **Sinh Viên** | `student1` | `password123` | Nguyễn Văn An (`SV2026-9921`) | Nộp hồ sơ học vụ, tải minh chứng, thảo luận với cán bộ, tra cứu mã QR quyết định. |
| 🎓 **Sinh Viên 2** | `student2` | `password123` | Phạm Minh Tuấn | Dùng để kiểm thử bảo mật IDOR (cô lập dữ liệu giữa các sinh viên). |
| 🔍 **Thẩm Định Viên** | `reviewer1` | `password123` | Trần Thị Mai Phương (*CTSV*) | Hàng đợi thẩm định 3 cột, đối chiếu Rule Engine, chuyển tuyến phòng ban, duyệt đơn và sinh chữ ký số. |
| 🛡️ **Quản Trị Viên** | `admin` *(hoặc `admin1`)* | `password123` | Quản Trị Viên Hệ Thống | Bảng điều khiển KPI toàn trường, quản lý người dùng, thay đổi vai trò, xuất báo cáo Audit Trail. |

---

## 6. TÀI LIỆU API & SWAGGER DOCUMENTATION

Khi Backend đang chạy, bạn có thể truy cập tài liệu API trực quan với giao diện Swagger UI:
* 🌐 **Swagger Interactive Docs:** **`http://localhost:3001/docs`**
* 🌐 **Redoc Alternative:** **`http://localhost:3001/redoc`**

### Các nhóm API chính:
* **`/api/login` & `/api/register`**: Xác thực JWT & Cấp Refresh Token.
* **`/api/auth/2fa/*`**: Tạo mã bí mật TOTP, kích hoạt và đăng nhập qua Google Authenticator.
* **`/api/cases`**: CRUD hồ sơ học vụ, lọc phân quyền IDOR tự động.
* **`/api/cases/{id}/review`**: Cán bộ phê duyệt hồ sơ và ký số HMAC-SHA256.
* **`/api/cases/verify/{id}`**: Tra cứu công khai tính hợp lệ của chữ ký số qua mã QR.
* **`/api/upload/evidence-ocr`**: Upload tệp kiểm tra Magic-bytes nhị phân và trích xuất OCR.
* **`/api/audits`**: Nhật ký kiểm toán thời gian thực chống giả mạo.

---

## 7. KIỂM THỬ BẢO MẬT & TOÀN VẸN (AUTOMATED TEST SUITE)

Hệ thống tích hợp bộ kịch bản kiểm thử bảo mật tự động **40 Assertions** kiểm tra toàn diện:
1. Băm mật khẩu Bcrypt & cấp JWT hợp lệ.
2. Kiểm tra phân quyền IDOR (Broken Access Control) - sinh viên không thể xem/sửa hồ sơ của nhau.
3. Cơ chế xác thực 2 bước (2FA) - xóa bỏ hoàn toàn backdoor.
4. Xoay vòng Refresh Token Rotation & chống tái sử dụng token đã hủy.
5. Kiểm định an toàn Rule Engine & chữ ký số xác thực QR.
6. Chống tệp tin giả mạo phần mở rộng và quét mã độc PDF nhị phân.

### Lệnh chạy kiểm thử:
```powershell
python EDUASSISTANT/test/run_security_suite.py
```
* **Kết quả kiểm thử:**
  ```text
  ═══════════════════════════════════════════════════════════════
  🎉 KẾT QUẢ KIỂM THỬ: 40 PASSED | 0 FAILED (100% ĐẠT CHUẨN)
  ═══════════════════════════════════════════════════════════════
  ```

---
**EduAssistant Platform v3.0** — Hệ thống Sẵn sàng cho Môi trường Đào tạo & Vận hành Doanh nghiệp.
