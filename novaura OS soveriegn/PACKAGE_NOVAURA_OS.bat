@echo off
setlocal enabledelayedexpansion
title Novaura Sovereign OS - One-Click Packager

echo =====================================================================
echo           NOVAURA SOVEREIGN OS - AUTOMATED RELEASE PACKAGER
echo =====================================================================
echo.
echo [*] Initializing packaging environment...
cd /d "%~dp0"

echo [*] Launching Tauri GNU compiler and NSIS bundler...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\tauri-gnu.ps1" -Mode build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] ERROR: Packaging failed with exit code %ERRORLEVEL%.
    echo [!] Please review the error log above.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo =====================================================================
echo [*] PACKAGING SUCCESSFUL!
echo =====================================================================
echo.
echo [1] Standalone Binary:
echo     "%~dp0src-tauri\target\release\app.exe"
echo.
echo [2] NSIS Windows Setup Installer:
echo     "%~dp0src-tauri\target\release\bundle\nsis\Novaura Sovereign OS_1.0.0_x64-setup.exe"
echo.
echo Opening output directory...
explorer.exe "%~dp0src-tauri\target\release\bundle\nsis"

echo.
set /p LAUNCH="Launch Novaura Sovereign OS now? (Y/N, default Y): "
if /i "!LAUNCH!"=="" set LAUNCH=Y
if /i "!LAUNCH!"=="Y" (
    echo [*] Starting Novaura Sovereign OS...
    start "" "%~dp0src-tauri\target\release\app.exe"
)
exit /b 0
