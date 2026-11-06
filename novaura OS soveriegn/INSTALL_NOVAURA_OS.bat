@echo off
setlocal enabledelayedexpansion
title Novaura Sovereign OS - Setup Installer

cd /d "%~dp0"
set "NSIS=%~dp0src-tauri\target\release\bundle\nsis"
set "INSTALLER="
rem Every build has its own version in the installer's name; take the newest.
for /f "delims=" %%F in ('dir /b /o:d "%NSIS%\Novaura Sovereign OS_*_x64-setup.exe" 2^>nul') do set "INSTALLER=%NSIS%\%%F"

if defined INSTALLER (
    echo [*] Launching "!INSTALLER!"...
    start "" "!INSTALLER!"
    exit /b 0
)

echo [!] No setup installer found in:
echo     "%NSIS%"
echo.
echo [*] Building package now...
call "%~dp0PACKAGE_NOVAURA_OS.bat"
