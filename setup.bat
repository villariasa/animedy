@echo off
REM ==========================================================
REM  Animedy - Automated Environment Setup Script (Windows)
REM  One-click setup for teammates & contributors
REM ==========================================================

echo ==========================================================
echo   Setting up Animedy Development Environment...
echo ==========================================================
echo.

REM 1. Check Node.js and npm
echo [1/5] Checking Node.js and npm...
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo Error: Node.js is not installed. Please install Node.js from https://nodejs.org
  pause
  exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
  echo Error: npm is not found in PATH.
  pause
  exit /b 1
)
node -v
npm -v
echo.

REM 2. Environment Variables (.env)
echo [2/5] Setting up environment variables (.env)...
if not exist ".env" (
  if exist ".env.example" (
    copy .env.example .env
    echo Created .env from .env.example
  )
) else (
  echo .env already exists. Preserving existing settings.
)
echo.

REM 3. Install Root / Backend Dependencies
echo [3/5] Installing backend and root dependencies...
call npm install
if %errorlevel% neq 0 (
  echo Error installing root dependencies.
  pause
  exit /b 1
)
echo.

REM 4. Install Frontend UI Dependencies
echo [4/5] Installing frontend UI dependencies (Svelte 5 / Vite)...
if exist "src\ui_test" (
  cd src\ui_test
  call npm install
  if %errorlevel% neq 0 (
    echo Error installing frontend dependencies.
    cd ..\..
    pause
    exit /b 1
  )
  cd ..\..
) else (
  echo Error: src\ui_test folder not found.
  pause
  exit /b 1
)
echo.

REM 5. Verification
echo [5/5] Verifying frontend build and types...
cd src\ui_test
call npm run check
cd ..\..
echo.

echo ==========================================================
echo   Setup Complete! Animedy is ready to run.
echo ==========================================================
echo To start developing:
echo   - Start Frontend only:  cd src\ui_test ^&^& npm run dev
echo   - Start Backend only:   npm run dev
echo.
echo Local URLs:
echo   Frontend : http://localhost:5173
echo   Backend  : http://localhost:3000
echo   Swagger  : http://localhost:3000/docs
echo ==========================================================
echo.
pause
