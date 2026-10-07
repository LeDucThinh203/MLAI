@echo off
chcp 65001 >nul
title CaseFlow AI - Trình Khởi Động Thủ Công
color 0b

echo.
echo ===============================================================================
echo          🚀 CASEFLOW AI - HỆ THỐNG THẨM ĐỊNH HỒ SƠ SINH VIÊN
echo ===============================================================================
echo.

:: 1. Kiểm tra môi trường Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0c
    echo [ERROR] Không tìm thấy Node.js trên máy tính của bạn!
    echo Vui lòng tải và cài đặt Node.js từ: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [*] Kiểm tra môi trường: Node.js đã sẵn sàng!

:: 2. Kiểm tra và cài đặt Dependencies nếu chưa có
if not exist "node_modules\" (
    echo [*] Đang cài đặt thư viện Backend (lần đầu khởi chạy)...
    call npm install
)

if not exist "frontend\node_modules\" (
    echo [*] Đang cài đặt thư viện Frontend (lần đầu khởi chạy)...
    cd frontend
    call npm install
    cd ..
)

echo.
echo -------------------------------------------------------------------------------
echo [*] Đang khởi chạy Máy chủ Python FastAPI Backend API (Port 3001)...
start "CaseFlow AI - Python Backend API [Port 3001]" cmd /k "title CaseFlow Python Backend && python -m uvicorn backend.server:app --port 3001 --host 0.0.0.0"

echo [*] Đang khởi chạy Ứng dụng Frontend React Vite (Port 5173)...
start "CaseFlow AI - Frontend Web [Port 5173]" cmd /k "title CaseFlow Frontend && cd frontend && npm run dev"

echo.
echo [*] Đang đợi dịch vụ khởi động hoàn tất (3 giây)...
timeout /t 3 /nobreak >nul

:: 3. Tự động mở trình duyệt web
echo [*] Đang mở trình duyệt web tại http://localhost:5173 ...
start http://localhost:5173

:MENU
cls
echo ===============================================================================
echo          🚀 CASEFLOW AI - BẢNG ĐIỀU KHIỂN HỆ THỐNG ĐANG HOẠT ĐỘNG
echo ===============================================================================
echo.
echo  • Frontend Web : http://localhost:5173
echo  • Backend API  : http://localhost:3001/api
echo  • SQLite DB    : shared/caseflow.sqlite
echo  • AI Engine    : Google Gemini Multimodal Vision
echo.
echo -------------------------------------------------------------------------------
echo  Tài khoản đăng nhập có sẵn:
echo   - Sinh viên      : student1  / password123
echo   - Thẩm định viên : reviewer1 / password123
echo   - Quản trị viên  : admin1    / password123
echo -------------------------------------------------------------------------------
echo.
echo  [1] Mở lại giao diện Web trên Trình duyệt (http://localhost:5173)
echo  [2] Chạy bộ kiểm thử bảo mật & hệ thống (Automated Security Tests)
echo  [3] Tắt toàn bộ tiến trình Web & Backend (Dừng Port 3001 & 5173)
echo  [4] Thoát bảng điều khiển
echo.
set /p choice="Nhập lựa chọn của bạn [1-4]: "

if "%choice%"=="1" (
    start http://localhost:5173
    goto MENU
)
if "%choice%"=="2" (
    echo.
    echo [*] Đang chạy bộ kiểm thử hệ thống...
    call npm test
    echo.
    pause
    goto MENU
)
if "%choice%"=="3" (
    echo.
    echo [*] Đang dừng các tiến trình máy chủ trên Port 3001 và 5173...
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>nul
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>nul
    echo [✓] Đã tắt toàn bộ dịch vụ thành công!
    timeout /t 2 >nul
    exit /b 0
)
if "%choice%"=="4" (
    exit /b 0
)

goto MENU
