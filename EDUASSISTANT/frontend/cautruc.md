# đŸ›ï¸ Cáº¤U TRĂC VĂ€ KIáº¾N TRĂC MĂƒ NGUá»’N FRONTEND - CASEFLOW AI

TĂ i liá»‡u nĂ y mĂ´ táº£ chi tiáº¿t sÆ¡ Ä‘á»“ tá»• chá»©c thÆ° má»¥c, chá»©c nÄƒng cá»§a tá»«ng module/component vĂ  luá»“ng dá»¯ liá»‡u trong giao diá»‡n ngÆ°á»i dĂ¹ng **CaseFlow AI (React + Vite)**.

---

## 1. đŸ“ SÆ  Äá»’ CĂ‚Y THÆ¯ Má»¤C (DIRECTORY TREE)

```
frontend/
â”œâ”€â”€ public/
â”‚   â”œâ”€â”€ _redirects                     # Cáº¥u hĂ¬nh Ä‘á»‹nh tuyáº¿n SPA cho Cloudflare / Render
â”‚   â”œâ”€â”€ favicon.svg                    # Biá»ƒu tÆ°á»£ng website
â”‚   â””â”€â”€ icons.svg                      # Sprite biá»ƒu tÆ°á»£ng SVG
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ api/
â”‚   â”‚   â””â”€â”€ client.js                  # Axios client, cáº¥u hĂ¬nh API_BASE, SERVER_BASE & Interceptor
â”‚   â”œâ”€â”€ context/
â”‚   â”‚   â””â”€â”€ AuthContext.jsx            # State quáº£n trá»‹ xĂ¡c thá»±c, Token, Refresh Token, 2FA TOTP
â”‚   â”œâ”€â”€ utils/
â”‚   â”‚   â””â”€â”€ formatters.jsx             # HĂ m Ä‘á»‹nh dáº¡ng ngĂ y giá» vi-VN & Badge tĂ­nh toĂ¡n SLA 48h
â”‚   â”œâ”€â”€ components/
â”‚   â”‚   â”œâ”€â”€ common/
â”‚   â”‚   â”‚   â”œâ”€â”€ ProtectedRoute.jsx     # Bá»™ báº£o vá»‡ tuyáº¿n Ä‘Æ°á»ng (Private Route Guard)
â”‚   â”‚   â”‚   â””â”€â”€ AppHeader.jsx          # Thanh Ä‘iá»u hÆ°á»›ng trĂªn cĂ¹ng, Ä‘á»•i Role Tab & AI Mode
â”‚   â”‚   â”œâ”€â”€ notifications/
â”‚   â”‚   â”‚   â””â”€â”€ NotificationBell.jsx   # ChuĂ´ng & Popover thĂ´ng bĂ¡o Ä‘áº©y thá»i gian thá»±c (Polling 10s)
â”‚   â”‚   â”œâ”€â”€ discussion/
â”‚   â”‚   â”‚   â””â”€â”€ CaseDiscussion.jsx     # KĂªnh trao Ä‘á»•i, bĂ¬nh luáº­n trá»±c tiáº¿p trĂªn há»“ sÆ¡ sinh viĂªn
â”‚   â”‚   â”œâ”€â”€ audit/
â”‚   â”‚   â”‚   â””â”€â”€ AuditTrailViewer.jsx   # Báº£ng nháº­t kĂ½ kiá»ƒm toĂ¡n báº¥t biáº¿n, bá»™ lá»c & xuáº¥t CSV
â”‚   â”‚   â””â”€â”€ modals/
â”‚   â”‚       â””â”€â”€ TwoFactorModal.jsx     # Popup kĂ­ch hoáº¡t / vĂ´ hiá»‡u hĂ³a báº£o máº­t 2FA (QR Code OTP)
â”‚   â”œâ”€â”€ pages/
â”‚   â”‚   â”œâ”€â”€ auth/
â”‚   â”‚   â”‚   â””â”€â”€ AuthPage.jsx           # MĂ n hĂ¬nh ÄÄƒng nháº­p, ÄÄƒng kĂ½ sinh viĂªn, OTP Challenge
â”‚   â”‚   â”œâ”€â”€ student/
â”‚   â”‚   â”‚   â””â”€â”€ StudentPortal.jsx      # Cá»•ng ná»™p há»“ sÆ¡ AI OCR, xem tiáº¿n Ä‘á»™ & quyáº¿t Ä‘á»‹nh
â”‚   â”‚   â”œâ”€â”€ reviewer/
â”‚   â”‚   â”‚   â””â”€â”€ ReviewerPortal.jsx     # Cá»•ng cĂ¡n bá»™: Tháº©m Ä‘á»‹nh há»“ sÆ¡, kĂ½ sá»‘ HMAC, xuáº¥t PDF/CSV
â”‚   â”‚   â”œâ”€â”€ admin/
â”‚   â”‚   â”‚   â””â”€â”€ AdminPortal.jsx        # Cá»•ng quáº£n trá»‹: Quáº£n lĂ½ ngÆ°á»i dĂ¹ng, phĂ¢n quyá»n, AI Toggle
â”‚   â”‚   â”œâ”€â”€ settings/
â”‚   â”‚   â””â”€â”€ AccountSettingsPortal.jsx # Trang cĂ¡ nhĂ¢n: Äá»•i máº­t kháº©u, avatar WebP, cĂ i Ä‘áº·t 2FA
â”‚   â”‚   â””â”€â”€ public/
â”‚   â”‚       â””â”€â”€ PublicVerificationPage.jsx # Cá»•ng tra cá»©u xĂ¡c thá»±c chá»¯ kĂ½ sá»‘ cĂ´ng khai qua mĂ£ QR
â”‚   â”œâ”€â”€ assets/                        # HĂ¬nh áº£nh logo, banner minh há»a
â”‚   â”œâ”€â”€ App.css                        # Style tĂ¹y biáº¿n bá»• sung
â”‚   â”œâ”€â”€ index.css                      # Há»‡ thá»‘ng Design System mĂ u tá»‘i (Cyber Dark UI)
â”‚   â”œâ”€â”€ App.jsx                        # Root Component & Bá»™ Ä‘á»‹nh tuyáº¿n React Router
â”‚   â””â”€â”€ main.jsx                       # Äiá»ƒm khá»Ÿi Ä‘á»™ng á»©ng dá»¥ng React (React DOM Entry)
â”œâ”€â”€ Dockerfile                         # Khá»Ÿi táº¡o container Nginx Ä‘Ă³ng gĂ³i Frontend
â”œâ”€â”€ package.json                       # Khai bĂ¡o dependencies (React, Vite, Lucide-React, Axios)
â”œâ”€â”€ vite.config.js                     # Cáº¥u hĂ¬nh mĂ¡y chá»§ phĂ¡t triá»ƒn Vite & proxy
â””â”€â”€ cautruc.md                         # TĂ i liá»‡u kiáº¿n trĂºc Frontend (tá»‡p nĂ y)
```

---

## 2. đŸ§© CHI TIáº¾T CĂC PHĂ‚N Há»† VĂ€ Tá»ªNG FILE

### 2.1. Táº§ng Káº¿t Ná»‘i API & Tráº¡ng ThĂ¡i ToĂ n Cá»¥c (API & Context)
- **`src/api/client.js`**:
  - Tá»± Ä‘á»™ng nháº­n diá»‡n biáº¿n mĂ´i trÆ°á»ng `VITE_API_BASE_URL` hoáº·c fallback vá» `http://localhost:3001/api`.
  - Thiáº¿t láº­p Axios Interceptor tá»± Ä‘á»™ng gáº¯n Header `Authorization: Bearer <Token>`.
- **`src/context/AuthContext.jsx`**:
  - Quáº£n lĂ½ phiĂªn lĂ m viá»‡c cá»§a ngÆ°á»i dĂ¹ng (`user`, `token`, `refreshToken`).
  - Há»— trá»£ cÆ¡ cháº¿ tá»± Ä‘á»™ng xoay vĂ²ng Token (`tryRefreshToken`) khi Access Token háº¿t háº¡n.
  - Cung cáº¥p cĂ¡c hĂ m xĂ¡c thá»±c: `login`, `login2FA`, `registerStudent`, `updateProfile`, `changePassword`, `generate2FA`, `enable2FA`, `disable2FA`, `logout`.

---

### 2.2. Táº§ng ThĂ nh Pháº§n DĂ¹ng Chung (Common Components)
- **`src/components/common/ProtectedRoute.jsx`**:
  - Cháº·n ngÆ°á»i dĂ¹ng chÆ°a Ä‘Äƒng nháº­p truy cáº­p vĂ o cĂ¡c trang ná»™i bá»™, tá»± Ä‘á»™ng Ä‘iá»u hÆ°á»›ng vá» `/login`.
- **`src/components/common/AppHeader.jsx`**:
  - Hiá»ƒn thá»‹ thĂ´ng tin ngÆ°á»i dĂ¹ng, áº£nh Ä‘áº¡i diá»‡n avatar WebP, huy hiá»‡u vai trĂ² (`STUDENT`, `REVIEWER`, `ADMIN`).
  - Cho phĂ©p quáº£n trá»‹ viĂªn chuyá»ƒn Ä‘á»•i cháº¿ Ä‘á»™ AI (`Live Gemini`, `Mock`, `Cache`) trá»±c tiáº¿p trĂªn thanh Ä‘iá»u hÆ°á»›ng.
- **`src/components/notifications/NotificationBell.jsx`**:
  - ChuĂ´ng thĂ´ng bĂ¡o vá»›i bá»™ Ä‘áº¿m tin chÆ°a Ä‘á»c.
  - Tá»± Ä‘á»™ng thÄƒm dĂ² (polling) má»—i 10 giĂ¢y Ä‘á»ƒ nháº­n thĂ´ng bĂ¡o má»›i khi há»“ sÆ¡ thay Ä‘á»•i tráº¡ng thĂ¡i hoáº·c cĂ³ bĂ¬nh luáº­n.
- **`src/components/discussion/CaseDiscussion.jsx`**:
  - Cho phĂ©p sinh viĂªn vĂ  cĂ¡n bá»™ nháº¯n tin, trao Ä‘á»•i trá»±c tiáº¿p trĂªn tá»«ng há»“ sÆ¡ Ä‘á»ƒ giáº£i trĂ¬nh minh chá»©ng.
- **`src/components/audit/AuditTrailViewer.jsx`**:
  - Nháº­t kĂ½ kiá»ƒm toĂ¡n Ä‘a chiá»u: Lá»c theo hĂ nh Ä‘á»™ng (`CREATE`, `APPROVE`, `REJECT`, `2FA_ENABLE`,...), mĂ£ há»“ sÆ¡, vai trĂ² vĂ  ngĂ y thĂ¡ng.
  - Há»— trá»£ xuáº¥t dá»¯ liá»‡u ra file CSV chuáº©n UTF-8 BOM.
- **`src/components/modals/TwoFactorModal.jsx`**:
  - Hiá»ƒn thá»‹ mĂ£ QR TOTP Ä‘á»ƒ quĂ©t báº±ng Google Authenticator / Authy.
  - XĂ¡c nháº­n mĂ£ 6 sá»‘ thá»i gian thá»±c vĂ  kĂ­ch hoáº¡t báº£o máº­t tĂ i khoáº£n.

---

### 2.3. Táº§ng Giao Diá»‡n Nghiá»‡p Vá»¥ Theo Vai TrĂ² (Role Portals)
- **`src/pages/auth/AuthPage.jsx`**:
  - ÄÄƒng nháº­p báº£o máº­t Ä‘a lá»›p (há»— trá»£ thá»­ thĂ¡ch 2FA náº¿u tĂ i khoáº£n Ä‘Ă£ báº­t).
  - ÄÄƒng kĂ½ tĂ i khoáº£n sinh viĂªn má»›i kĂ¨m phĂ¢n bá»• mĂ£ sinh viĂªn (MSSV) vĂ  khoa trá»±c thuá»™c.
- **`src/pages/student/StudentPortal.jsx`**:
  - Biá»ƒu máº«u ná»™p há»“ sÆ¡ há»c vá»¥ thĂ´ng minh kĂ¨m kiá»ƒm tra Ä‘á»‹nh dáº¡ng minh chá»©ng (PNG, JPG, WebP, PDF).
  - TrĂ­ch xuáº¥t thĂ´ng tin OCR vĂ  gá»£i Ă½ káº¿t quáº£ tá»± Ä‘á»™ng báº±ng AI.
  - Theo dĂµi danh sĂ¡ch Ä‘Æ¡n cĂ¡ nhĂ¢n, Ä‘áº¿m ngÆ°á»£c thá»i háº¡n giáº£i quyáº¿t SLA 48h.
- **`src/pages/reviewer/ReviewerPortal.jsx`**:
  - HĂ ng Ä‘á»£i tháº©m Ä‘á»‹nh há»“ sÆ¡: xem trÆ°á»›c minh chá»©ng, káº¿t quáº£ trĂ­ch xuáº¥t AI, giáº£i trĂ¬nh luáº­t leo thang.
  - PhĂª duyá»‡t / Tá»« chá»‘i / YĂªu cáº§u bá»• sung há»“ sÆ¡ kĂ¨m **KĂ½ sá»‘ Ä‘iá»‡n tá»­ HMAC-SHA256**.
  - Xuáº¥t báº£ng in PDF quyáº¿t Ä‘á»‹nh há»c vá»¥ vĂ  xuáº¥t danh sĂ¡ch Ä‘Æ¡n ra CSV.
- **`src/pages/admin/AdminPortal.jsx`**:
  - Quáº£n lĂ½ danh sĂ¡ch ngÆ°á»i dĂ¹ng toĂ n há»‡ thá»‘ng, cáº­p nháº­t vai trĂ², má»Ÿ khĂ³a máº­t kháº©u.
  - Theo dĂµi chá»‰ sá»‘ há»‡ thá»‘ng (System Metrics), dung lÆ°á»£ng lÆ°u trá»¯ minh chá»©ng.
- **`src/pages/settings/AccountSettingsPortal.jsx`**:
  - Cáº­p nháº­t thĂ´ng tin cĂ¡ nhĂ¢n, táº£i áº£nh Ä‘áº¡i diá»‡n cáº¯t vuĂ´ng tá»‘i Æ°u WebP, Ä‘á»•i máº­t kháº©u vĂ  quáº£n lĂ½ báº£o máº­t 2FA.
- **`src/pages/public/PublicVerificationPage.jsx`**:
  - Trang xĂ¡c minh cĂ´ng khai dĂ nh cho cÆ¡ quan bĂªn ngoĂ i hoáº·c sinh viĂªn quĂ©t mĂ£ QR trĂªn giáº¥y chá»©ng nháº­n Ä‘á»ƒ kiá»ƒm tra tĂ­nh toĂ n váº¹n cá»§a chá»¯ kĂ½ sá»‘ HMAC.

---

## 3. đŸ”„ LUá»’NG Dá»® LIá»†U CHĂNH (DATA FLOW)

```mermaid
flowchart TD
    User([NgÆ°á»i DĂ¹ng / Sinh ViĂªn / CĂ¡n Bá»™]) -->|TÆ°Æ¡ng TĂ¡c| AppHeader
    User -->|Truy Cáº­p Tuyáº¿n ÄÆ°á»ng| AppRouter[React Router - App.jsx]
    
    AppRouter -->|ChÆ°a ÄÄƒng Nháº­p| AuthPage[AuthPage.jsx]
    AppRouter -->|CĂ´ng Khai| PublicVerification[PublicVerificationPage.jsx]
    AppRouter -->|ÄĂ£ ÄÄƒng Nháº­p| ProtectedRoute[ProtectedRoute.jsx]
    
    ProtectedRoute -->|Role = STUDENT| StudentPortal[StudentPortal.jsx]
    ProtectedRoute -->|Role = REVIEWER| ReviewerPortal[ReviewerPortal.jsx]
    ProtectedRoute -->|Role = ADMIN| AdminPortal[AdminPortal.jsx]
    ProtectedRoute -->|Tab Settings| AccountSettings[AccountSettingsPortal.jsx]
    
    StudentPortal & ReviewerPortal & AdminPortal -->|Gá»i API| ApiClient[src/api/client.js]
    ApiClient -->|XĂ¡c Thá»±c Bearer Token| BackendServer[(Python FastAPI Backend :3001)]
```

---

## 4. đŸ€ HÆ¯á»NG DáºªN KHá»I CHáº Y PHĂT TRIá»‚N (DEVELOPMENT)

```bash
# 1. Di chuyá»ƒn vĂ o thÆ° má»¥c frontend
cd frontend

# 2. CĂ i Ä‘áº·t thÆ° viá»‡n phá»¥ thuá»™c
npm install

# 3. Cháº¡y mĂ¡y chá»§ phĂ¡t triá»ƒn Vite
npm run dev

# 4. BiĂªn dá»‹ch báº£n Ä‘Ă³ng gĂ³i Production
npm run build
```