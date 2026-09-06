@echo off
title Concetto Biologico — Dermal Canvas
cd /d "%~dp0"

echo ===================================================
echo     CONCETTO BIOLOGICO — DERMAL CANVAS
echo     Minimalist Contemporary Interactive Art
echo ===================================================
echo.

:: Check node_modules
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    echo.
)

echo Starting local exhibition server...
:: Open browser after 1 second delay in background
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:5173"

:: Run Vite development server
call npm run dev -- --port 5173 --open
pause
