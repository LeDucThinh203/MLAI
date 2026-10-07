# 📖 HƯỚNG DẪN VẬN HÀNH & KHỞI CHẠY THỦ CÔNG (RUNBOOK)
**Dự Án**: CaseFlow AI – Hệ Thống Thẩm Định & Quản Lý Hồ Sơ Sinh Viên  
**Phiên Bản**: 2.5 (Enterprise Edition: SQLite + AI OCR + 2FA + Rule Engine + Real-time Notification + QR Verification + SLA Routing + Docker)

---

## 📌 MỤC LỤC
1. [Yêu Cầu Môi Trường](#1-yêu-cầu-môi-trường)
2. [Cài Đặt Thư Viện (Dependencies)](#2-cài-đặt-thư-viện-dependencies)
3. [Cấu Hình & Cơ Sở Dữ Liệu SQLite](#3-cấu-hình--cơ-sở-dữ-liệu-sqlite)
4. [Khởi Chạy Hệ Thống Thủ Công (2 Terminal)](#4-khởi-chạy-hệ-thống-thủ-công-2-terminal)
5. [Khởi Chạy Tự Động Bằng Docker (1 Câu Lệnh)](#5-khởi-chạy-tự-động-bằng-docker-1-câu-lệnh)
6. [Tài Khoản Thử Nghiệm Mặc Định](#6-tài-khoản-thử-nghiệm-mặc-định)
7. [Quy Trình Kiểm Thử Đầy Đủ (Enterprise Smoke Test)](#7-quy-trình-kiểm-thử-đầy-đủ-enterprise-smoke-test)
8. [Xử Lý Sự Cố Thường Gặp (Troubleshooting)](#8-xử-lý-sự-cố-thường-gặp-troubleshooting)

---

## 1. Yêu Cầu Môi Trường

Trước khi bắt đầu, hãy đảm bảo máy tính đã cài đặt các công cụ sau:
* **Node.js**: Phiên bản `>= 18.x` hoặc `>= 20.x` ([Tải Node.js](https://nodejs.org/))
* **NPM**: Phiên bản `>= 9.x` (đi kèm sẵn với Node.js)
* **Docker & Docker Compose** *(Tùy chọn nếu muốn chạy container)*
* **Hệ điều hành**: Windows 10/11, macOS, hoặc Linux
* **Cổng mạng khả dụng (Ports)**:
  * Backend API: `3001`
  * Frontend Web: `5173` (hoặc cổng `5174` nếu `5173` bận)

Kiểm tra phiên bản bằng terminal:
```powershell
node -v
npm -v
```

---

## 2. Cài Đặt Thư Viện (Dependencies)

Mở **Terminal / PowerShell** tại thư mục gốc của dự án (`d:\Gehihi` hoặc thư mục lưu mã nguồn):

### Bước 2.1: Cài đặt thư viện Backend
```powershell
npm install
```

Các thư viện chính được cài đặt ở Backend:
* `express`, `cors`, `dotenv`: Máy chủ web & API RESTful.
* `jsonwebtoken`, `bcryptjs`, `speakeasy`, `qrcode`: Bảo mật JWT, băm mật khẩu Bcrypt, OTP 2FA TOTP chuẩn RFC 6238.
* `sqlite3`: Cơ sở dữ liệu SQLite quan hệ tin cậy, lưu trữ bền vững duy nhất.
* `multer`, `sharp`: Xử lý upload và nén tối ưu minh chứng hình ảnh sang `.webp` & hỗ trợ quét sâu PDF.
* `@google/genai`: AI Multimodal Vision & OCR trích xuất dữ liệu từ Google Gemini AI.

### Bước 2.2: Cài đặt thư viện Frontend
```powershell
cd Part1_JWT_Auth/frontend
npm install
cd ../..
```

---

## 3. Cấu Hình & Cơ Sở Dữ Liệu SQLite

Hệ thống sử dụng cơ chế **Zero-Config SQLite Database**:
* Tập tin CSDL SQLite tự động khởi tạo tại: `shared/caseflow.sqlite` (hoặc biến `DATA_DIR`).
* Tự động tạo các bảng: `users`, `cases`, `audits`, `notifications`, `comments`, `refresh_tokens`.
* Trong môi trường Development: Tự động nạp dữ liệu mẫu (Seed Data) cho mục đích kiểm thử.
* Trong môi trường Production: Tự động tạo Super Admin với mật khẩu ngẫu nhiên bảo mật cao và kích hoạt cờ bắt buộc đổi mật khẩu `mustChangePassword=1`.
* Tệp minh chứng được lưu ngoài thư mục web công khai và phục vụ qua endpoint có xác thực: `/api/evidence/:filename`.

Cấu hình biến môi trường tại `.env` ở thư mục gốc:
```env
PORT=3001
NODE_ENV=development
JWT_SECRET=your_secret_at_least_32_characters_long
REFRESH_SECRET=your_refresh_secret_at_least_32_characters
SIGNATURE_KEY=your_digital_signature_hmac_key_2026
GEMINI_API_KEY=your_gemini_api_key_here
AI_MODE=live # Các giá trị: live | mock | cache
```

---

## 4. Khởi Chạy Nhanh 1-Click Bằng File `Run.bat` (Khuyên Dùng Trên Windows)

Để khởi động toàn bộ hệ thống (Backend + Frontend + Tự động mở trình duyệt) chỉ với **1 cú đúp chuột**:
1. Nhấp đúp vào tệp **[`Run.bat`](file:///d:/Gehihi/Run.bat)** tại thư mục gốc của dự án.
2. Script sẽ tự động:
   * Kiểm tra môi trường Node.js.
   * Cài đặt dependencies nếu là lần đầu chạy.
   * Khởi động Backend API tại `http://localhost:3001`.
   * Khởi động Frontend Web tại `http://localhost:5173`.
   * Tự động mở trình duyệt web và hiển thị bảng điều khiển menu tiện lợi (Mở web, Chạy test, Dừng máy chủ).

---

## 5. Khởi Chạy Thủ Công Qua Terminal (2 Cửa Sổ)

Nếu muốn khởi chạy thủ công bằng lệnh trong terminal:

### Terminal 1: Khởi chạy Backend Server (Port 3001)
```powershell
npm start
# Hoặc: node Part1_JWT_Auth/backend/server.js
```
Khi thành công, màn hình hiển thị:
```text
╔══════════════════════════════════════════════════════════════════════════╗
║             🚀 CASEFLOW AI - ENTERPRISE HARDENED ENGINE 3.0              ║
╠══════════════════════════════════════════════════════════════════════════╣
║  • Status: ONLINE & SQLite Single Source of Truth Verified               ║
║  • Port: 3001                                                            ║
║  • Base URL: http://localhost:3001/api                                   ║
╚══════════════════════════════════════════════════════════════════════════╝
[Database] SQLite Database kết nối thành công tại: D:\Gehihi\shared\caseflow.sqlite
```

---

### Terminal 2: Khởi chạy Frontend Dev Server (Port 5173)
```powershell
cd Part1_JWT_Auth/frontend
npm run dev
```
👉 Mở trình duyệt và truy cập: **`http://localhost:5173`**

---

## 5. Khởi Chạy Tự Động Bằng Docker (1 Câu Lệnh)

Nếu máy tính đã cài đặt **Docker Desktop**, bạn chỉ cần chạy 1 câu lệnh duy nhất từ thư mục gốc:

```bash
docker-compose up --build -d
```
* **Frontend**: `http://localhost:5173`
* **Backend API**: `http://localhost:3001`
* Để tắt hệ thống:
```bash
docker-compose down
```

---

## 6. Tài Khoản Thử Nghiệm Mặc Định

| Vai Trò (Role) | Tên Đăng Nhập | Mật Khẩu | Họ Và Tên / Đơn Vị | Chức Năng Chính |
|:---|:---|:---|:---|:---|
| 🎓 **Sinh Viên** | `student1` | `password123` | Nguyễn Văn An (`SV2026-9921`) | Nộp hồ sơ, upload minh chứng Sharp WebP/PDF, trao đổi bình luận (Discussion), in quyết định PDF có mã QR, nhận thông báo đẩy. |
| 🎓 **Sinh Viên 2** | `student2` | `password123` | Lê Thị Mai (`SV2026-8834`) | Nộp đơn và theo dõi trạng thái. |
| 🔍 **Thẩm Định Viên** | `reviewer1` | `password123` | Trần Thị Mai Phương (*Phòng CTSV*) | Hàng đợi 3 cột, xem Ma trận Rule Engine, kiểm tra SLA quá hạn, điều phối phòng ban (Re-routing), thảo luận trực tiếp, duyệt đơn, xuất Audit Trail theo ngày. |
| 🛡️ **Quản Trị Viên** | `admin1` | `password123` | Quản Trị Hệ Thống (*Phòng CNTT*) | Dashboard KPI hệ thống, quản lý tài khoản người dùng, cấp quyền, cấu hình hệ thống, xuất toàn bộ báo cáo CSV/PDF. |

> 💡 **Tính năng Xác thực 2 Bước (2FA)**: Sử dụng chuẩn TOTP an toàn (RFC 6238). Quét mã QR bằng ứng dụng Google Authenticator / Microsoft Authenticator để lấy mã 6 chữ số. Đã loại bỏ hoàn toàn các mã backdoor thử nghiệm để bảo đảm an toàn dữ liệu thực tế.

---

## 7. Chạy Bộ Kiểm Thử An Toàn & Phân Quyền Tự Động (28 Assertions)

Để kiểm tra toàn diện khả năng chống IDOR, băm mật khẩu Bcrypt, cô lập Audit Trail, xoay vòng Refresh Token và an toàn AI Rule Engine:

```powershell
node test/security_and_system.test.js
```

Kết quả mong đợi: `🎉 KẾT QUẢ KIỂM THỬ: 28 PASSED | 0 FAILED`.

---

## 8. Quy Trình Kiểm Thử Đầy Đủ (Enterprise Smoke Test)

1. **Kiểm tra Trung tâm Thông báo (Notification Hub)**:
   - Đăng nhập `student1`, quan sát biểu tượng Chuông thông báo trên thanh Header.
   - Bấm vào chuông để xem danh sách thông báo và bấm *"Đọc tất cả"*.
2. **Kiểm tra Kênh Thảo Luận (In-Case Discussion)**:
   - Vào tab *"Hồ Sơ Của Bạn"* -> Ở dưới từng hồ sơ, nhập câu hỏi vào ô bình luận và bấm **"Gửi"**.
   - Đăng nhập `reviewer1` -> Kiểm tra thông báo có chuông mới và xem bình luận của sinh viên, gửi phản hồi lại ngay trên hồ sơ.
3. **Kiểm tra SLA Hạn Chót & Điều Phối Phòng Ban (Department Routing)**:
   - Ở tài khoản Reviewer: Nhìn huy hiệu đếm ngược SLA (`⏳ Còn 48h`, `⚠️ Sắp hết hạn`, `🚨 Quá hạn`).
   - Thử bấm đổi phòng ban thụ lý hồ sơ (ví dụ: chuyển từ *Phòng Kế hoạch - Tài chính* sang *Phòng Quản lý Đào tạo*).
4. **Kiểm tra Xuất Quyết Định & Trang Xác Thực Công Khai (Public QR Verification)**:
   - Với hồ sơ đã duyệt (`APPROVED`), bấm nút **"📄 In / Lưu Quyết Định PDF"** để xem bản in chuẩn hành chính có dấu mộc và mã QR.
   - Bấm nút **"Mã QR Xác Thực"** (hoặc truy cập `http://localhost:5173/verify?caseId=CASE-2026-001`) để kiểm tra trang tra cứu công khai không cần đăng nhập.

---

## 9. Xử Lý Sự Cố Thường Gặp (Troubleshooting)

### Lỗi 1: Cổng 3001 hoặc 5173 đang bị chiếm dụng (`EADDRINUSE`)
```powershell
Get-NetTCPConnection -LocalPort 3001 | Select-Object OwningProcess
Stop-Process -Id <PID> -Force
```

### Lỗi 2: File minh chứng tải về bị từ chối 403 Forbidden
* Đảm bảo bạn đang đăng nhập tài khoản sinh viên sở hữu hồ sơ hoặc tài khoản Cán bộ thẩm định (`REVIEWER`/`ADMIN`). Hệ thống đã khóa quyền truy cập tệp để chống rò rỉ dữ liệu sinh viên.

---
**Tài liệu được cập nhật tự động và sẵn sàng phục vụ triển khai Enterprise!** 🚀
