@echo off
REM Quick build and run script for PadiPay Admin Dashboard

echo.
echo ========================================
echo PadiPay Admin Dashboard - Build & Run
echo ========================================
echo.

REM Delete Next.js cache
if exist .next (
    echo Clearing Next.js cache...
    rmdir /s /q .next
    echo Cache cleared.
)

REM Delete node_modules if needed for fresh install
REM Uncomment below if you need a clean install
REM if exist node_modules (
REM     rmdir /s /q node_modules
REM     echo Node modules deleted.
REM )

echo.
echo Building project...
echo.

REM Build the project
call npm run build

if %errorlevel% neq 0 (
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo Build successful!
echo.
echo Starting development server...
echo.

REM Run dev server
call npm run dev
