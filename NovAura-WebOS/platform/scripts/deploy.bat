@echo off
REM NovAura Platform - Polsia Deployment Script (Windows)
REM Usage: deploy.bat [environment]
REM Environments: production (default), staging

setlocal enabledelayedexpansion

set "ENVIRONMENT=%~1"
if "%~1"=="" set "ENVIRONMENT=production"

echo 🚀 Deploying NovAura Platform to Polsia (%ENVIRONMENT%)...

REM Check if polsia CLI is installed
where polsia >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Polsia CLI not found
    echo Install it with: npm install -g @polsia/cli
    exit /b 1
)

REM Check if user is logged in
polsia whoami >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Not logged in to Polsia
    echo Running: polsia login
    polsia login
)

REM Clean and build
echo 📦 Building project...
if exist dist rmdir /s /q dist
call npm run build

if %errorlevel% neq 0 (
    echo ❌ Build failed
    exit /b 1
)

echo ✅ Build successful

REM Deploy
echo 🚀 Deploying to Polsia...

if "%ENVIRONMENT%"=="production" (
    polsia deploy --static ./dist --prod
) else (
    polsia deploy --static ./dist --staging
)

if %errorlevel% equ 0 (
    echo ✅ Deployment successful!
    echo 🌐 Your site is live at: https://novauraverse.com
) else (
    echo ❌ Deployment failed
    exit /b 1
)

pause
