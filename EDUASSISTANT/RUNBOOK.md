# 📖 HƯỚNG DẪN VẬN HÀNH & KHỞI CHẠY HỆ THỐNG (RUNBOOK)
**Dự Án**: EDUASSISTANT – Hệ Thống Thẩm Định & Quản Lý Hồ Sơ Học Vụ Thông Minh  
**Đội Thi**: Team 1 (MLAI Hackathon 2026 - Track VNG – Option A: Escalation Referee)  
**Phiên Bản**: 3.0 (Enterprise Python Edition: FastAPI + React Vite + PostgreSQL + Gemini OCR + Adaptive Escalation Referee + Verify Harness)

---

## 📌 MỤC LỤC
1. [Yêu Cầu Môi Trường](#1-yêu-cầu-môi-trường)
2. [Cài Đặt Thư Viện (Dependencies)](#2-cài-đặt-thư-viện-dependencies)
3. [Cấu Hình Biến Môi Trường (.env)](#3-cấu-hình-biến-môi-trường-env)
4. [Khởi Chạy Hệ Thống Thủ Công (2 Terminal)](#4-khởi-chạy-hệ-thống-thủ-công-2-terminal)
5. [Tài Khoản Thử Nghiệm Mặc Định](#5-tài-khoản-thử-nghiệm-mặc-định)
6. [Cổng Giám Khảo & Verify Harness (/judge)](#6-cổng-giám-khảo--verify-harness-judge)
7. [Chạy Kiểm Chuẩn & Benchmark Độc Lập](#7-chạy-kiểm-chuẩn--benchmark-độc-lập)
8. [Bộ Kiểm Thử Toàn Diện (Security & Competition Suites)](#8-bộ-kiểm-thử-toàn-diện-security--competition-suites)
9. [Xử Lý Sự Cố Thường Gặp (Troubleshooting)](#9-xử-lý-sự-cố-thường-gặp-troubleshooting)

---

## 1. Yêu Cầu Môi Trường
* **Python**: Phiên bản `>= 3.10`
* **Node.js**: Phiên bản `>= 18.x`
* **NPM**: Phiên bản `>= 9.x`
* **Hệ cơ sở dữ liệu**: Render PostgreSQL (PostgreSQL 15/16 Managed Service)
* **Cổng mạng (Ports)**:
  * Backend API: `3001`
  * Frontend Web: `5173`

---

## 2. Cài Đặt Thư Viện (Dependencies)

Mở terminal tại thư mục `EDUASSISTANT/`:

### Bước 2.1: Cài đặt thư viện Backend Python
```powershell
pip install -r requirements.txt
```

### Bước 2.2: Cài đặt thư viện Frontend
```powershell
cd frontend
npm install
cd ..
```

---

## 3. Cấu Hình Biến Môi Trường (.env)

Create the local `.env` file in the `EDUASSISTANT/` project root. Do not commit it:
```ini
PORT=3001
NODE_ENV=development
APP_ENV=development
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
DATA_DIR=backend/app/db
AI_MODE=mock
GEMINI_API_KEY=your_gemini_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
JWT_SECRET=<generate-a-random-secret-at-least-32-characters>
REFRESH_SECRET=<generate-a-different-random-secret-at-least-32-characters>
SIGNATURE_KEY=<generate-a-random-secret-at-least-32-characters>
```

Để bật AI live, đặt `AI_MODE=live`. Hệ thống lấy các model Gemini có hỗ trợ `generateContent`, thử tuần tự đến khi có phản hồi JSON hợp lệ; sau đó mới lấy danh sách model OpenRouter có giá đầu vào và đầu ra bằng 0, thử lần lượt. Chỉ khi không model nào trả dữ liệu hợp lệ thì mới dùng dữ liệu mẫu.

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
| **SINH VIÊN** | `student1` | `password123` | Nộp hồ sơ, tải minh chứng, theo dõi trạng thái, tra cứu QR |
| **THẨM ĐỊNH VIÊN** | `reviewer1` | `password123` | Thẩm định, Duyệt, Từ chối, Yêu cầu bổ sung, Override, Dừng, Feedback |
| **QUẢN TRỊ VIÊN** | `admin1` | `password123` | Toàn quyền, cấu hình AI Mode, giám sát Audit Trail, chỉ số Benchmark |

---

## 6. Cổng Giám Khảo & Verify Harness (/judge)

Truy cập trực tiếp: `http://localhost:5173/judge` (hoặc nhấp **Cổng Giám Khảo** trên thanh điều hướng).  
Cho phép:
- Xem tóm tắt nhanh dự án và kiến trúc Escalation Referee.
- Bấm **"Chạy Verify Harness"** (`POST /api/verify/run`) kiểm chuẩn tức thì 6 ca nghiệp vụ trọng yếu in-memory (100% deterministic).
- Chuyển hướng nhanh đến Cổng Thẩm định, Nhật ký Kiểm toán, và Cổng Quản trị.

---

## 7. Chạy Kiểm Chuẩn & Benchmark Độc Lập

Để đo lường hiệu suất và tính chính xác quyết định trên tập kiểm thử độc lập (Held-Out Benchmark):
```powershell
cd EDUASSISTANT
python benchmark/run_benchmark.py
```
Kết quả được xuất tự động:
* `benchmark/results/latest.json`
* `benchmark/results/latest.csv`

---

## 8. Bộ Kiểm Thử Toàn Diện (Security & Competition Suites)

### 8.1. Kiểm thử 40 Tiêu chí Bảo mật & Phân quyền (Security Suite)
```powershell
cd EDUASSISTANT
python test/run_security_suite.py
```

### 8.2. Kiểm thử 15 Tiêu chuẩn Cuộc thi (Competition Features Suite)
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
