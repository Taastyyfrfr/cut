@echo off
title Stopping Concetto Biologico...
cd /d "%~dp0"

echo ===================================================
echo     STOPPING CONCETTO BIOLOGICO SERVER
echo ===================================================
echo.

echo 1. Closing exhibition server window...
taskkill /F /FI "WINDOWTITLE eq Concetto Biologico [Server]*" /T >nul 2>&1

echo 2. Freeing network ports 5173 and 5174...
powershell -NoProfile -ExecutionPolicy Bypass -Command "5173,5174 | ForEach-Object { Get-NetTCPConnection -LocalPort $_ -ErrorAction SilentlyContinue } | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -gt 0 } | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue; Write-Host ('   - Stopped process holding port (PID ' + $_ + ')') }"

echo 3. Terminating active Vite development workers...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match 'vite' -or $_.CommandLine -match 'cut' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; Write-Host ('   - Stopped Vite worker (PID ' + $_.ProcessId + ')') }"

:: Language-independent netstat fallback
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5173 "') do (
    if "%%a" neq "0" taskkill /F /T /PID %%a >nul 2>&1
)

echo.
echo ===================================================
echo     Exhibition server successfully stopped!
echo ===================================================
echo.
timeout /t 3 >nul 2>&1
exit /b 0
