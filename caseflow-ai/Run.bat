@echo off
setlocal enabledelayedexpansion
title CaseFlow AI Launcher

echo ========================================================
echo   CASEFLOW AI - Enterprise Platform
echo ========================================================
echo.

:: 1. Check Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not found. Please install Python 3.10+ and add it to PATH.
    pause
    exit /b 1
)

:: 2. Check Node.js for Frontend
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found. Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: 3. Check and install frontend dependencies
if not exist "%~dp0frontend\node_modules\" (
    echo [*] Installing frontend dependencies...
    cd /d "%~dp0frontend"
    call npm install
    cd /d "%~dp0"
)

echo.
echo [*] Starting Python Backend Server on port 3001...
start "CaseFlow Backend (Python)" cmd /k "title CaseFlow Backend [3001] && cd /d "%~dp0backend" && python server.py"

echo [*] Starting Frontend Server on port 5173...
start "CaseFlow Frontend" cmd /k "title CaseFlow Frontend [5173] && cd /d "%~dp0frontend" && npm run dev"

echo.
echo [*] Waiting 3 seconds for services to initialize...
ping -n 4 127.0.0.1 >nul

echo [*] Opening browser at http://localhost:5173 ...
start http://localhost:5173

echo.
echo ========================================================
echo   CASEFLOW AI IS RUNNING:
echo   - Frontend: http://localhost:5173
echo   - Backend:  http://localhost:3001/api (Python FastAPI)
echo   - Docs:     http://localhost:3001/docs
echo   - Database: Microsoft SQL Server 2025 (THINH\SQL2025 / CaseFlowAI)
echo ========================================================
echo.
pause
