@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo   EDUASSISTANT - Starting Backend and Frontend
echo ========================================================

:: 1. Check frontend dependencies
if not exist "%~dp0frontend\node_modules\" (
    echo [*] Installing frontend dependencies...
    cd /d "%~dp0frontend"
    call npm install
    cd /d "%~dp0"
)

:: 2. Launch Python Backend
echo.
echo [1/2] Launching Python Backend Server on port 3001...
start "EduAssistant Backend (Python)" cmd /k "title EduAssistant Backend [3001] && cd /d "%~dp0backend" && python server.py"

:: 3. Launch Frontend
echo [2/2] Launching Frontend on port 5173...
start "EduAssistant Frontend" cmd /k "title EduAssistant Frontend [5173] && cd /d "%~dp0frontend" && npm run dev"

echo.
echo ========================================================
echo   SYSTEM IS STARTING:
echo   - Frontend Portal:  http://localhost:5173
echo   - Backend API:      http://localhost:3001/api (Python FastAPI)
echo   - Swagger Docs:     http://localhost:3001/docs
echo   - Database:         Microsoft SQL Server 2025 (THINH\SQL2025 / CaseFlowAI)
echo ========================================================
echo.
