# 🚀 HƯỚNG DẪN TRIỂN KHAI CLOUDFLARE PAGES + RENDER (KHÔNG DÙNG DOCKER)

> Tài liệu này hướng dẫn chi tiết quy trình đưa hệ thống **CaseFlow AI** lên môi trường Production thực tế hoàn toàn **miễn phí (Free Tier)** hoặc **Starter**, sử dụng:
> * **Frontend (React SPA)**: Triển khai trên **Cloudflare Pages** (Băng thông không giới hạn, CDN toàn cầu cực nhanh, SSL tự động).
> * **Backend API (Node.js Express + SQLite)**: Triển khai trên **Render (onrender.com)** dưới dạng **Web Service** tiêu chuẩn (Native Node.js runtime, không cần Docker).

---

## 🏗️ KIẾN TRÚC TRIỂN KHAI (DEPLOYMENT ARCHITECTURE)

```mermaid
flowchart LR
    User["👤 Người Dùng / Sinh Viên / Cán Bộ"]

    subgraph Cloudflare ["🌐 Cloudflare Pages (Frontend SPA)"]
        CF_CDN["Cloudflare Global Edge CDN"]
        ReactApp["React 19 + Vite Dist\n(https://caseflow-ai.pages.dev)"]
        CF_CDN --> ReactApp
    end

    subgraph Render ["⚡ Render Web Service (Backend API)"]
        RenderAPI["Node.js 20+ Express API\n(https://caseflow-api.onrender.com)"]
        SQLiteDB[("💾 SQLite Database\ncaseflow.sqlite")]
        UploadsDir[("🖼️ Uploads Storage\n/uploads")]
        RenderAPI --> SQLiteDB
        RenderAPI --> UploadsDir
    end

    User -->|1. Truy cập Web| CF_CDN
    ReactApp -->|2. Gọi REST API (HTTPS + JWT)| RenderAPI
```

---

## 📋 BẢNG THÔNG SỐ CẤU HÌNH NHANH

| Thành Phần | Dịch Vụ Khuyên Dùng | Root Directory | Build Command | Output / Start Command | Biến Môi Trường (Env Vars) |
|:---|:---|:---|:---|:---|:---|
| **Backend API** | **Render** (Web Service) | `.` (Gốc dự án) | `npm install` | `node Part1_JWT_Auth/backend/server.js` | `JWT_SECRET`, `REFRESH_SECRET`, `SIGNATURE_KEY`, `NODE_ENV=production` |
| **Frontend Web** | **Cloudflare Pages** | `Part1_JWT_Auth/frontend` | `npm run build` | `dist` | `VITE_API_BASE_URL=https://<your-render-api>.onrender.com/api` |

---

## PHẦN 1: TRIỂN KHAI BACKEND LÊN RENDER (ONRENDER.COM)

### Bước 1.1: Đẩy mã nguồn lên GitHub / GitLab
1. Đảm bảo toàn bộ mã nguồn của dự án đã được commit và push lên kho lưu trữ GitHub của bạn:
   ```bash
   git add .
   git commit -m "feat: ready for cloudflare and render deployment"
   git push origin main
   ```

### Bước 1.2: Tạo Web Service trên Render
1. Truy cập [dashboard.render.com](https://dashboard.render.com/) và đăng nhập.
2. Bấm nút **New +** ở góc phải -> Chọn **Web Service**.
3. Chọn kho lưu trữ GitHub chứa dự án CaseFlow AI (`Gehihi`).
4. Điền các thông số cấu hình:
   * **Name**: `caseflow-api` (hoặc tên tùy chọn).
   * **Region**: `Singapore` (để tối ưu tốc độ về Việt Nam) hoặc `Oregon`.
   * **Branch**: `main`.
   * **Root Directory**: Để trống (hoặc nhập `.`).
   * **Runtime**: Chọn **`Node`** *(Tuyệt đối không chọn Docker)*.
   * **Build Command**:
     ```bash
     npm install
     ```
   * **Start Command**:
     ```bash
     node Part1_JWT_Auth/backend/server.js
     ```
   * **Instance Type**: Chọn gói **Free** (hoặc Starter).

### Bước 1.3: Sinh Bí Mật Bảo Mật & Cấu hình Biến Môi Trường (Environment Variables)

> [!IMPORTANT]
> **Không sử dụng mật khẩu/secret mẫu!** Hãy sinh các chuỗi ngẫu nhiên 64 ký tự an toàn bằng lệnh sau trên terminal của bạn:
> ```bash
> # Sinh 3 khóa bí mật ngẫu nhiên riêng biệt:
> node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
> node -e "console.log('REFRESH_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
> node -e "console.log('SIGNATURE_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
> ```

Tại mục **Environment Variables** trên Render, thêm các biến môi trường:

| Tên Biến (Key) | Giá Trị (Value) | Ghi Chú |
|:---|:---|:---|
| `NODE_ENV` | `production` | Bắt buộc để kích hoạt chế độ bảo mật Production |
| `PORT` | `10000` | Render tự động gán cổng |
| `JWT_SECRET` | *(Chuỗi ngẫu nhiên sinh bằng lệnh trên - tối thiểu 32 ký tự)* | Khóa ký Access Token |
| `REFRESH_SECRET` | *(Chuỗi ngẫu nhiên sinh bằng lệnh trên - tối thiểu 32 ký tự)* | Khóa ký Refresh Token |
| `SIGNATURE_KEY` | *(Chuỗi ngẫu nhiên sinh bằng lệnh trên - tối thiểu 32 ký tự)* | Khóa chữ ký số HMAC-SHA256 |
| `AI_MODE` | `live` *(hoặc `mock` / `cache`)* | Chế độ động cơ AI |
| `GEMINI_API_KEY` | *(Khóa API Google Gemini của bạn)* | Kích hoạt Gemini Multimodal Live OCR |
| `DATA_DIR` | `/data` *(nếu gắn Persistent Disk)* | Thư mục lưu bền vững SQLite & Uploads |

### Bước 1.4: Cấu hình Lưu Trữ Bền Vững (Persistent Disk - Tùy Chọn Khuyên Dùng)
Để giữ nguyên file SQLite `caseflow.sqlite` và các tệp minh chứng khi Render khởi động lại:
1. Vào tab **Disks** trong Web Service Render -> Bấm **Add Disk**.
2. **Name**: `caseflow-data`.
3. **Mount Path**: `/data`.
4. **Size**: `1 GB`.
5. Đặt biến môi trường `DATA_DIR=/data`. Hệ thống sẽ tự động lưu cơ sở dữ liệu SQLite và thư mục tệp tải lên tại `/data/caseflow.sqlite` và `/data/uploads`.

5. Bấm **Create Web Service** (hoặc *Manual Deploy*). Render sẽ tự động cài đặt package và khởi chạy máy chủ.
6. Khi hoàn tất, bạn sẽ nhận được đường dẫn API có dạng:
   👉 **`https://caseflow-api.onrender.com`**

Kiểm tra API hoạt động bằng cách mở: `https://caseflow-api.onrender.com/api/health`.

---

## PHẦN 2: TRIỂN KHAI FRONTEND LÊN CLOUDFLARE PAGES

### Bước 2.1: Tạo Project trên Cloudflare Pages
1. Đăng nhập vào [dash.cloudflare.com](https://dash.cloudflare.com/).
2. Ở thanh menu bên trái, chọn **Workers & Pages** -> Chọn tab **Pages** -> Bấm **Connect to Git** (hoặc *Create application* -> *Pages*).
3. Chọn tài khoản GitHub của bạn và chọn repository `Gehihi`.

### Bước 2.2: Thiết lập Build Settings
Tại màn hình cấu hình build:
* **Project name**: `caseflow-ai` (hoặc tên tùy chọn).
* **Production branch**: `main`.
* **Framework preset**: Chọn **`Vite`**.
* **Root directory (Advanced)**:
  ```text
  Part1_JWT_Auth/frontend
  ```
* **Build command**:
  ```bash
  npm run build
  ```
* **Build output directory**:
  ```text
  dist
  ```

### Bước 2.3: Thêm Biến Môi Trường kết nối tới Render Backend
Trong phần **Environment variables (advanced)**, thêm biến:

| Variable name | Value |
|:---|:---|
| `VITE_API_BASE_URL` | `https://caseflow-api.onrender.com/api` *(Thay bằng URL Render của bạn)* |

4. Bấm **Save and Deploy**.
5. Cloudflare Pages sẽ tự động kéo code, build Vite SPA và xuất bản ra toàn cầu chỉ sau ~30 giây.
6. Bạn sẽ nhận được URL website có dạng:
   👉 **`https://caseflow-ai.pages.dev`**

> 💡 **Định tuyến SPA đã sẵn sàng**: Tệp `Part1_JWT_Auth/frontend/public/_redirects` đã cấu hình sẵn quy tắc `/* /index.html 200`, giúp người dùng F5 hoặc truy cập trực tiếp các đường dẫn như `/verify?caseId=CASE-2026-001` không bao giờ bị lỗi 404.

---

## PHẦN 3: KIỂM THỬ HỆ THỐNG SAU KHI TRIỂN KHAI

1. **Truy cập Giao diện**: Mở `https://caseflow-ai.pages.dev` trên trình duyệt.
2. **Đăng nhập thử nghiệm**:
   * Sinh viên: `student1` / `password123`
   * Thẩm định viên: `reviewer1` / `password123`
   * Quản trị viên: `admin1` / `password123`
3. **Nộp hồ sơ & Xem trước minh chứng**: Tải ảnh lên và kiểm tra tốc độ nén WebP.
4. **Kiểm tra Tra cứu Quyết định & Mã QR**: Truy cập `https://caseflow-ai.pages.dev/verify?caseId=CASE-2026-001`.

---

## 🛠️ XỬ LÝ SỰ CỐ THƯỜNG GẶP TRÊN CLOUD

### 1. Render Free Tier chuyển sang chế độ Sleep sau 15 phút không hoạt động
* **Hiện tượng**: Lần đầu bấm đăng nhập có thể mất 30-50 giây để Render đánh thức instance.
* **Giải pháp**:
  * Nâng cấp gói **Starter ($7/tháng)** trên Render để instance luôn chạy 24/7 không sleep.
  * Hoặc sử dụng dịch vụ ping miễn phí như [UptimeRobot](https://uptimerobot.com/) gửi request định kỳ mỗi 10 phút tới `https://caseflow-api.onrender.com/api/health`.

### 2. Dữ liệu SQLite trên gói Free của Render bị reset khi restart
* **Nguyên nhân**: Instance Free dùng hệ thống file tạm (ephemeral filesystem). Khi instance sleep và thức dậy, SQLite sẽ tự động nạp lại seed data ban đầu.
* **Giải pháp**: Nếu muốn lưu trữ lâu dài không bao giờ mất dữ liệu:
  * Gắn **Render Persistent Disk** (1GB giá $0.25/tháng) và thêm biến môi trường:
    `DATA_DIR=/var/data`
  * Hệ thống CaseFlow AI đã hỗ trợ sẵn biến `DATA_DIR` để tự động lưu `caseflow.sqlite` và thư mục `/uploads` vào ổ đĩa gắn ngoài này.
