@echo off
REM PadiPay Admin Dashboard - Quick Start Script (Windows)

echo.
echo ========================================
echo PadiPay Admin Dashboard - Quick Start
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo X Node.js is not installed. Please install Node.js 18+ first.
    pause
    exit /b 1
)

echo [OK] Node.js installed
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo     Version: %NODE_VERSION%
echo.

REM Check if npm is installed
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo X npm is not installed. Please install npm first.
    pause
    exit /b 1
)

echo [OK] npm installed
for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
echo     Version: %NPM_VERSION%
echo.

REM Install dependencies
echo [*] Installing dependencies...
call npm install

if %errorlevel% neq 0 (
    echo X Failed to install dependencies
    pause
    exit /b 1
)

echo [OK] Dependencies installed successfully
echo.

REM Check if .env.local exists
if not exist .env.local (
    echo [!] .env.local file not found
    echo [*] Creating .env.local from template...
    
    if exist .env.local.example (
        copy .env.local.example .env.local
        echo [OK] Created .env.local
        echo.
        echo [!] Please update .env.local with your Firebase credentials:
        echo     - NEXT_PUBLIC_FIREBASE_API_KEY
        echo     - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
        echo     - NEXT_PUBLIC_FIREBASE_PROJECT_ID
        echo     - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
        echo     - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
        echo     - NEXT_PUBLIC_FIREBASE_APP_ID
        echo.
    )
)

REM Start development server
echo [*] Starting development server...
echo.
echo Available scripts:
echo   npm run dev     - Start development server
echo   npm run build   - Build for production
echo   npm start       - Run production build
echo   npm run lint    - Run linter
echo.
echo Web Dashboard will be available at: http://localhost:3000
echo.

call npm run dev
pause
