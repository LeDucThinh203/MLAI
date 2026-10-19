@echo off
setlocal
title EduAssistant Launcher
cd /d "%~dp0"

echo ========================================================
echo   EDUASSISTANT - Java Enterprise Platform
echo ========================================================
echo.

where java >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Java is not found. Install Java 8 or newer and add it to PATH.
    pause
    exit /b 1
)
if not exist "mvnw.cmd" (
    echo [ERROR] Maven Wrapper is missing from this project.
    pause
    exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not found. Install Node.js to run the frontend.
    pause
    exit /b 1
)
if not exist "frontend\node_modules\" (
    echo [*] Installing frontend dependencies...
    pushd frontend
    call npm install
    popd
    if errorlevel 1 exit /b 1
)

echo [*] Building Java backend...
call mvnw.cmd -f backend\pom.xml -DskipTests package
if errorlevel 1 (
    echo [ERROR] Java backend build failed.
    pause
    exit /b 1
)

echo [*] Starting Java backend on port 3001...
start "EduAssistant Backend (Java)" cmd /k "cd /d ""%~dp0"" && java -Dfile.encoding=UTF-8 -jar ""%~dp0backend\target\eduassistant-backend.jar"""

echo [*] Starting frontend on port 5173...
start "EduAssistant Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

timeout /t 3 /nobreak >nul
start http://localhost:5173

echo.
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:3001/api
echo   API docs: http://localhost:3001/docs
echo.
pause
