@echo off
title NovAura Build + Deploy
color 0B

echo.
echo  ═══════════════════════════════════════════════
echo    NovAura — Full Build + Deploy (All)
echo  ═══════════════════════════════════════════════
echo.

cd /d "z:\Novaura platform\NovAura-WebOS"

echo [1/5] Building Cloud Functions...
cd functions
call npm run build
if %ERRORLEVEL% neq 0 (
    echo  FAILED: Functions build error
    pause
    exit /b 1
)
cd ..

echo.
echo [2/5] Building Frontend (WebOS + Platform + Landing)...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo  FAILED: Frontend build error
    pause
    exit /b 1
)

echo.
echo [3/5] Standardizing dist structure...
if exist "dist\platform" rmdir /s /q "dist\platform"
xcopy /E /I /Q "platform\dist" "dist\platform"

echo.
echo [4/5] Deploying hosting + functions to Firebase...
call firebase deploy --only hosting,functions
if %ERRORLEVEL% neq 0 (
    echo  WARNING: Deploy had errors - check output above
    pause
)

echo.
echo [5/5] Committing to Git...
cd /d "z:\Novaura platform"
git add NovAura-WebOS/src/App.jsx
git add NovAura-WebOS/src/pages/DownloadPage.jsx
git add NovAura-WebOS/src/pages/StaffPage.jsx
git add NovAura-WebOS/src/hooks/useSystemTelemetry.js
git add NovAura-WebOS/src/components/MobileLayout.jsx
git add NovAura-WebOS/src/components/Sidebar.jsx
git add NovAura-WebOS/src/components/WindowManager.jsx
git add NovAura-WebOS/src/components/windows/GamesArenaWindow.jsx
git add NovAura-WebOS/src/components/windows/DownloadCenterWindow.jsx
git add NovAura-WebOS/src/index.css
git add NovAura-WebOS/src/services/aiService.js
git add NovAura-WebOS/firebase.json
git add NovAura-WebOS/functions/src/nova.ts
git add NovAura-WebOS/functions/src/index.ts
git add NovAura-WebOS/functions/src/init.ts
git add NovAura-WebOS/functions/src/api/routes/stripe.ts
git add NovAura-WebOS/functions/src/services/moderationService.ts
git add NovAura-Coding-Partner/package.json
git add NovAura-Coding-Partner/src/extension.js
git add Novaura-Desktop/src-tauri/src/main.rs
git add Novaura-Ops/src/services/novaService.ts
git add build-deploy.bat
git commit -m "feat: download center + staff command center at /download and /staff, fix OS routing, full deploy coverage"

echo.
echo  ═══════════════════════════════════════════════
echo    DONE — novaura.life is live
echo  ═══════════════════════════════════════════════
echo.
pause
