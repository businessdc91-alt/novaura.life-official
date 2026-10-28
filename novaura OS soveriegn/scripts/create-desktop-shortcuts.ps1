$ws = New-Object -ComObject WScript.Shell
$desktopPaths = @(
    [Environment]::GetFolderPath('Desktop'),
    "$env:USERPROFILE\Desktop",
    "$env:USERPROFILE\OneDrive\Desktop"
) | Select-Object -Unique | Where-Object { Test-Path $_ }

$iconPath = "Z:\Novaura platform\novaura OS soveriegn\src-tauri\icons\icon.ico"
$appPath = "Z:\Novaura platform\novaura OS soveriegn\src-tauri\target\release\app.exe"
$pkgPath = "Z:\Novaura platform\novaura OS soveriegn\PACKAGE_NOVAURA_OS.bat"
$setupPath = "Z:\Novaura platform\novaura OS soveriegn\src-tauri\target\release\bundle\nsis\Novaura Sovereign OS_1.0.0_x64-setup.exe"

foreach ($d in $desktopPaths) {
    # 1. Launcher shortcut (double-click to run app)
    $s1 = $ws.CreateShortcut("$d\Novaura Sovereign OS.lnk")
    $s1.TargetPath = $appPath
    $s1.WorkingDirectory = "Z:\Novaura platform\novaura OS soveriegn\src-tauri\target\release"
    $s1.Description = "Launch Novaura Sovereign OS"
    $s1.IconLocation = "$iconPath,0"
    $s1.Save()

    # 2. Packager shortcut (double-click to re-package anytime)
    $s2 = $ws.CreateShortcut("$d\Package Novaura OS.lnk")
    $s2.TargetPath = $pkgPath
    $s2.WorkingDirectory = "Z:\Novaura platform\novaura OS soveriegn"
    $s2.Description = "Re-package Novaura Sovereign OS Installer & Executable"
    $s2.IconLocation = "$iconPath,0"
    $s2.Save()

    # 3. Setup Installer shortcut (double-click to install)
    $s3 = $ws.CreateShortcut("$d\Install Novaura Sovereign OS.lnk")
    $s3.TargetPath = $setupPath
    $s3.WorkingDirectory = "Z:\Novaura platform\novaura OS soveriegn\src-tauri\target\release\bundle\nsis"
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
