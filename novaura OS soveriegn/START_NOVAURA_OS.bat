@echo off
setlocal enabledelayedexpansion
title Novaura Sovereign OS - Launcher

cd /d "%~dp0"
set "APP_EXE=%~dp0src-tauri\target\release\app.exe"

if exist "%APP_EXE%" (
    echo [*] Starting Novaura Sovereign OS...
    start "" "%APP_EXE%"
    exit /b 0
)

echo [!] Production executable not found at:
echo     "%APP_EXE%"
echo.
echo [*] Launching in Development Mode...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\tauri-gnu.ps1" -Mode dev
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] Launch failed.
    pause
)
