@echo off
setlocal
cd /d "%~dp0"

echo [JCO GUI] Starting...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0gui\scripts\bootstrap-windows.ps1"

if errorlevel 1 (
  echo.
  echo [JCO GUI] Startup failed. Review the message above.
  pause
)
