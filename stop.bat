@echo off
title Stop Concetto Biologico
cd /d "%~dp0"

echo ===================================================
echo     STOPPING CONCETTO BIOLOGICO SERVER
echo ===================================================
echo.

setlocal enabledelayedexpansion
set "STOPPED=0"

:: Find any process listening on port 5173
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr /r ":5173[ ]" ^| findstr LISTENING') do (
    echo Stopping process ID %%a on port 5173...
    taskkill /F /PID %%a >nul 2>&1
    set "STOPPED=1"
)

if "!STOPPED!"=="1" (
    echo.
    echo Server successfully stopped.
) else (
    echo No server was found running on port 5173.
)

echo.
timeout /t 2 /nobreak >nul
exit /b 0
