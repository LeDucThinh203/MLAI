@echo off
echo ========================================================
echo   CASEFLOW AI - Starting Backend and Frontend
echo ========================================================

echo [1/2] Launching Backend (FastAPI + SQL Server)...
start "CaseFlow Backend" cmd /k "cd /d %~dp0backend && .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

echo [2/2] Launching Frontend (React + Vite)...
start "CaseFlow Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================================
echo   HE THONG DANG KHOI CHAY:
echo   - Backend API Docs: http://localhost:8000/docs
echo   - Frontend Portal:  http://localhost:5173
echo ========================================================
echo.
