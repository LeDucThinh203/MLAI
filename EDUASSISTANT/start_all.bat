@echo off
setlocal
cd /d "%~dp0"

where java >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Java is not found. Install Java 8 or newer and add it to PATH.
    pause
    exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not found. Install Node.js and add it to PATH.
    pause
    exit /b 1
)
if not exist "mvnw.cmd" (
    echo [ERROR] Maven Wrapper is missing from this project.
    pause
    exit /b 1
)
if not exist "frontend\node_modules\" (
    pushd frontend
    call npm install
    popd
    if errorlevel 1 exit /b 1
)

echo [1/2] Building and starting Java backend...
start "EduAssistant Backend (Java)" cmd /k "cd /d ""%~dp0"" && call mvnw.cmd -f backend\pom.xml -DskipTests spring-boot:run"
echo [2/2] Starting frontend...
start "EduAssistant Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

echo.
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:3001/api
echo   API docs: http://localhost:3001/docs
