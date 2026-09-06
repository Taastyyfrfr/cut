@echo off
title Concetto Biologico [Server]
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

echo Starting local exhibition server on port 5173...
:: Open browser after 2 seconds in background
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:5173"

:: Run Vite development server
call npx vite --port 5173 --strictPort
