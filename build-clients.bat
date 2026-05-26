@echo off
title NovAura — Build All Clients
color 0B

echo.
echo  ═══════════════════════════════════════════════════
echo    NovAura — Build All Native Clients
echo    Desktop + Ops + VS Code Extension
echo  ═══════════════════════════════════════════════════
echo.

set ROOT=z:\Novaura platform

:: ── 1. VS Code Extension (.vsix) ─────────────────────────────────────────────
echo [1/3] Building VS Code Extension (.vsix)...
cd /d "%ROOT%\NovAura-Coding-Partner"

:: Install vsce if not present
call npx vsce --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo       Installing vsce...
    call npm install -g @vscode/vsce
)

:: Install extension deps
if not exist node_modules (
    call npm install
)

call npx vsce package --no-dependencies
if %ERRORLEVEL% neq 0 (
    echo  WARNING: VS Code extension build failed - check output above
) else (
    echo  OK — .vsix created in NovAura-Coding-Partner\
)

:: ── 2. NovAura Desktop (Tauri) ───────────────────────────────────────────────
echo.
echo [2/3] Building NovAura Desktop (Tauri release)...
cd /d "%ROOT%\Novaura-Desktop"

if not exist node_modules (
    echo       Installing dependencies...
    call npm install
)

call npm run tauri build
if %ERRORLEVEL% neq 0 (
    echo  WARNING: Desktop build failed
    echo  Installer will be at: src-tauri\target\release\bundle\nsis\
) else (
    echo  OK — Desktop installer built
    echo  Location: src-tauri\target\release\bundle\nsis\
)

:: ── 3. Novaura Ops (Tauri) ───────────────────────────────────────────────────
echo.
echo [3/3] Building Novaura Ops (Tauri release)...
cd /d "%ROOT%\Novaura-Ops"

if not exist node_modules (
    echo       Installing dependencies...
    call npm install
)

call npm run tauri build
if %ERRORLEVEL% neq 0 (
    echo  WARNING: Ops build failed
    echo  Installer will be at: src-tauri\target\release\bundle\nsis\
) else (
    echo  OK — Ops installer built
    echo  Location: src-tauri\target\release\bundle\nsis\
)

:: ── Upload ───────────────────────────────────────────────────────────────────
echo.
echo  ═══════════════════════════════════════════════════
echo    All builds complete. Uploading to Firebase Storage...
echo  ═══════════════════════════════════════════════════
echo.

cd /d "%ROOT%"
node upload-assets.js

echo.
echo  ═══════════════════════════════════════════════════
echo    DONE — check novaura.life/download
echo  ═══════════════════════════════════════════════════
echo.
pause