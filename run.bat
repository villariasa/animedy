@echo off
REM ==========================================================
REM  Animedy - Continuous Anime Watching Platform
REM  Starts both Backend API (Hono) and Frontend UI (Vite)
REM ==========================================================

title Animedy Launcher
cd /d "%~dp0"

echo ==========================================================
echo   Animedy - Starting Servers
echo ==========================================================
echo.

REM 1. Check Node.js and npm
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo Error: Node.js is not found in PATH. Please install Node.js from https://nodejs.org
  pause
  exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
  echo Error: npm is not found in PATH.
  pause
  exit /b 1
)

REM 2. Ensure .env exists
if not exist ".env" (
  if exist ".env.example" (
    echo [.env] Creating .env from .env.example...
    copy .env.example .env >nul
  )
)

REM 3. Ensure node_modules exist, if not install dependencies
if not exist "node_modules" (
  echo [Notice] Root dependencies not installed. Installing...
  call npm install
)

if not exist "src\ui_test\node_modules" (
  echo [Notice] Frontend dependencies not installed. Installing...
  cd src\ui_test
  call npm install
  cd ..\..
)

echo.
echo Starting Backend API (Port 3000)...
start "Animedy Backend (Port 3000)" cmd /k "npm run dev"

echo Starting Frontend UI (Port 5173)...
start "Animedy Frontend (Port 5173)" cmd /k "cd src\ui_test && npm run dev"

echo.
echo ==========================================================
echo   Animedy is launching!
echo ==========================================================
echo   Frontend : http://localhost:5173
echo   Backend  : http://localhost:3000
echo   API Docs : http://localhost:3000/docs
echo ==========================================================
echo.
echo Both servers are running in their respective windows.
echo Opening browser to http://localhost:5173 ...
echo.

timeout /t 3 >nul
start http://localhost:5173
exit /b 0

