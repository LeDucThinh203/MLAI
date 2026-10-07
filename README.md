# CaseFlow AI - Hệ Thống Quản Lý, Thẩm Định & Xét Duyệt Hồ Sơ Sinh Viên
> Nền tảng thẩm định hồ sơ sinh viên thông minh kết hợp **AI Multimodal OCR (Gemini)**, **Bộ máy Quy tắc Nghiệp vụ (Rule Engine)**, **Cơ sở dữ liệu SQLite duy nhất (Single Source of Truth)**, **Bảo mật phân quyền IDOR & Bcrypt**, và **Quy trình Thẩm định Con người (Human-in-the-Loop Review)**.

---

## 📚 TÀI LIỆU DỰ ÁN (QUAN TRỌNG)
* 📖 **[RUNBOOK.md](./RUNBOOK.md)**: **Hướng dẫn cài đặt, cấu hình & khởi chạy hệ thống thủ công chi tiết từ A-Z.**
* 🌟 **[SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md)**: **Tài liệu giới thiệu toàn diện về tính năng, workflow nghiệp vụ, kiến trúc hệ thống và sơ đồ Mermaid chi tiết.**
* 🚀 **[DEPLOY_CLOUDFLARE_RENDER.md](./DEPLOY_CLOUDFLARE_RENDER.md)**: **Hướng dẫn triển khai Production lên Cloudflare Pages (Frontend) & Render (Backend Node.js API) không dùng Docker.**

---

## 🎯 Bảng Đối Chiếu Các Yêu Cầu & Tính Năng Đã Hoàn Thiện

| STT | Phân Hệ / Tính Năng | Trạng Thái | Mô Tả Kỹ Thuật & Giải Pháp An Toàn |
|:---:|:---|:---:|:---|
| **1** | **Xác thực JWT & Băm Mật Khẩu Bcrypt** | ✅ **100%** | Băm mật khẩu bằng `bcryptjs` (Salt 10 vòng), JWT Access Token (1h), Refresh Token xoay vòng (Rotation) & thu hồi an toàn. Khóa bí mật JWT nạp qua biến môi trường. |
| **2** | **Xác thực 2 bước (2FA TOTP Chuẩn)** | ✅ **100%** | Chuẩn RFC 6238 qua `speakeasy` & mã QR `qrcode`. Đã loại bỏ hoàn toàn các mã backdoor thử nghiệm. Tắt 2FA yêu cầu mật khẩu hiện tại + mã TOTP hợp lệ. |
| **3** | **Khóa Quyền IDOR & Truy Cập Hồ Sơ** | ✅ **100%** | Chống IDOR: Sinh viên chỉ được xem, bình luận, và xuất quyết định của chính mình (`req.user.id`). Tham số `studentId` do client gửi lên bị bỏ qua đối với tài khoản sinh viên. |
| **4** | **Bảo Vệ Minh Chứng & Magic Bytes** | ✅ **100%** | Kiểm tra nhị phân Magic Bytes nội dung file (`PNG`, `JPEG`, `WebP`, `PDF`), đổi tên mã hóa ngẫu nhiên. Phục vụ tệp qua endpoint xác thực `/api/evidence/:filename` có kiểm tra quyền sở hữu. |
| **5** | **Cơ Sở Dữ Liệu SQLite Duy Nhất** | ✅ **100%** | SQLite (`shared/caseflow.sqlite`) là nguồn dữ liệu duy nhất (Single Source of Truth) cho toàn bộ thao tác đọc/ghi. Đảm bảo khởi tạo DB hoàn tất trước khi mở cổng nhận request. |
| **6** | **AI Multimodal OCR & Human Review** | ✅ **Đã tích hợp** | OCR Live có thể đọc bytes minh chứng đã upload; OCR/mock và kết quả hồ sơ được lưu, liên kết phía server với chủ sở hữu. Auto-approve hiện **đang tắt** cho tới khi độ tin cậy OCR được hiệu chuẩn độc lập; hồ sơ đều qua cán bộ thẩm định. |
| **7** | **Bộ Máy Quy Tắc & Ma Trận 5 Lý Do Leo Thang** | ✅ **100%** | Đặt tại `shared/ruleEngine.js`: Tự động phân loại `OWNERSHIP_UNCLEAR`, `FACT_UNKNOWN`, `DATA_CONFLICT`, `AUTHORITY_REQUIRED`, `POLICY_OUT_OF_SCOPE`. |
| **8** | **Giao Diện Thẩm Định 3 Cột (Reviewer Portal)** | ✅ **100%** | Hàng đợi đơn, đối chiếu Ma trận Rule Engine, xem minh chứng Sharp WebP, ghi nhận danh tính cán bộ và điều phối phòng ban (Re-Route). |
| **9** | **Nhật Ký Kiểm Toán & Cô Lập Dữ Liệu** | ✅ **100%** | Sinh viên chỉ xem nhật ký của chính mình; Reviewer/Admin xem toàn trường, lọc theo ngày và xuất CSV chuẩn UTF-8 BOM. |
| **10** | **Chữ Ký Số & Bản In Quyết Định PDF/HTML** | ✅ **100%** | Sinh mã băm chữ ký điện tử **HMAC-SHA256**, trang tra cứu công khai `/verify?caseId=...` qua QR, và mẫu bản in Quyết định học vụ chuẩn hành chính. |

---

## 🚀 Khởi Chạy Nhanh (Quick Start)

### 1. Khởi chạy Backend (Port 3001)
```powershell
npm start
# Hoặc: node backend/server.js
```

### 2. Khởi chạy Frontend (Port 5173)
```powershell
cd frontend
npm run dev
```

### 3. Chạy Toàn Bộ Bộ Kiểm Thử An Toàn & Phân Quyền (40 Assertions)
```powershell
npm test
# Hoặc: node test/run_security_suite.js
```

👉 Mở trình duyệt truy cập: **`http://localhost:5173`**

---

## 🔑 Tài Khoản Thử Nghiệm Mặc Định

| Vai Trò (Role) | Tên Đăng Nhập | Mật Khẩu | Họ Và Tên / Đơn Vị | Chức Năng Chính |
|:---|:---|:---|:---|:---|
| 🎓 **Sinh Viên** | `student1` | `password123` | Nguyễn Văn An (`SV2026-9921`) | Nộp hồ sơ, upload minh chứng an toàn, thảo luận hồ sơ, in quyết định có QR. |
| 🎓 **Sinh Viên 2** | `student2` | `password123` | Lê Thị Mai (`SV2026-8834`) | Nộp đơn độc lập, kiểm thử phân quyền cô lập IDOR. |
| 🔍 **Thẩm Định Viên** | `reviewer1` | `password123` | Trần Thị Mai Phương (*Phòng CTSV*) | Hàng đợi 3 cột, đối chiếu Rule Engine, chuyển tuyến phòng ban, duyệt đơn sinh chữ ký số. |
| 🛡️ **Quản Trị Viên** | `admin1` | `password123` | Quản Trị Hệ Thống (*Phòng CNTT*) | Dashboard KPI hệ thống, quản lý tài khoản, xuất báo cáo toàn trường. |

---

## 📁 Cấu Trúc Mã Nguồn Thực Tế (Directory Structure)

```text
Gehihi/
├── backend/
│   └── server.js              # Máy chủ Backend duy nhất hợp nhất Parts 1, 2, 3 (JWT, 2FA, Case, AI, Audit)
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # Ứng dụng React SPA duy nhất hợp nhất toàn bộ giao diện Parts 1, 2, 3
│   │   ├── index.css          # Dark SaaS Theme
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── shared/
│   ├── database.js            # SQLite schema migrations, index & connection
│   ├── db.js                  # Data Access Layer duy nhất (Single Source of Truth)
│   ├── ruleEngine.js          # Bộ máy quy tắc & 5 lý do leo thang nghiệp vụ
│   ├── uploadService.js       # Kiểm tra Magic Bytes, nén Sharp WebP & lưu trữ an toàn
│   ├── aiService.js           # AI Engine kết nối Gemini Multimodal OCR
│   ├── ocrService.js          # Trích xuất thực thể văn bản
│   └── reportService.js       # Xuất báo cáo CSV & HTML in ấn
├── test/
│   ├── run_security_suite.js  # Runner tự động khởi chạy môi trường cô lập
│   └── security_and_system.test.js # Bộ 40 test assertions kiểm thử an toàn
├── Run.bat                    # Script khởi động 1-Click tự động mở web
├── RUNBOOK.md                 # Hướng dẫn vận hành & kiểm thử chi tiết
├── SYSTEM_OVERVIEW.md         # Giới thiệu kiến trúc & sơ đồ Mermaid
├── DEPLOY_CLOUDFLARE_RENDER.md # Hướng dẫn deploy Cloudflare Pages + Render
├── docker-compose.yml         # Cấu hình container Docker
├── Dockerfile                 # Backend container definition
├── render.yaml                # Cấu hình deploy tự động Render
├── package.json
└── README.md
```
