@echo off
setlocal enabledelayedexpansion
title Novaura Sovereign OS - Setup Installer

cd /d "%~dp0"
set "INSTALLER=%~dp0src-tauri\target\release\bundle\nsis\Novaura Sovereign OS_1.0.0_x64-setup.exe"

if exist "%INSTALLER%" (
    echo [*] Launching Novaura Sovereign OS Setup Installer...
    start "" "%INSTALLER%"
    exit /b 0
)

echo [!] Setup installer not found at:
echo     "%INSTALLER%"
echo.
echo [*] Building package now...
call "%~dp0PACKAGE_NOVAURA_OS.bat"
