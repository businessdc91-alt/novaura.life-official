$ws = New-Object -ComObject WScript.Shell
$desktopPaths = @(
    [Environment]::GetFolderPath('Desktop'),
    "$env:USERPROFILE\Desktop",
    "$env:USERPROFILE\OneDrive\Desktop"
) | Select-Object -Unique | Where-Object { Test-Path $_ }

# Paths come from where this script lives, so it works from any checkout.
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$releaseDir = Join-Path $root "src-tauri\target\release"
$iconPath = Join-Path $root "src-tauri\icons\icon.ico"
$appPath = Join-Path $releaseDir "app.exe"
$pkgPath = Join-Path $root "PACKAGE_NOVAURA_OS.bat"
# The installer script launches the newest setup.exe the build left behind.
$setupPath = Join-Path $root "INSTALL_NOVAURA_OS.bat"

foreach ($d in $desktopPaths) {
    # 1. Launcher shortcut (double-click to run app)
    $s1 = $ws.CreateShortcut("$d\Novaura Sovereign OS.lnk")
    $s1.TargetPath = $appPath
    $s1.WorkingDirectory = $releaseDir
    $s1.Description = "Launch Novaura Sovereign OS"
    $s1.IconLocation = "$iconPath,0"
    $s1.Save()

    # 2. Packager shortcut (double-click to re-package anytime)
    $s2 = $ws.CreateShortcut("$d\Package Novaura OS.lnk")
    $s2.TargetPath = $pkgPath
    $s2.WorkingDirectory = $root
    $s2.Description = "Re-package Novaura Sovereign OS Installer & Executable"
    $s2.IconLocation = "$iconPath,0"
    $s2.Save()

    # 3. Setup Installer shortcut (double-click to install)
    $s3 = $ws.CreateShortcut("$d\Install Novaura Sovereign OS.lnk")
    $s3.TargetPath = $setupPath
    $s3.WorkingDirectory = $root
    $s3.Description = "Install Novaura Sovereign OS to Windows"
    $s3.IconLocation = "$iconPath,0"
    $s3.Save()

    Write-Host "Updated shortcuts in: $d"
}

# Signal Windows Explorer shell to redraw icons
try {
    & ie4uinit.exe -show 2>$null
} catch {}

Write-Host "All Windows Desktop shortcuts refreshed with the new Novaura Sovereign icon."
