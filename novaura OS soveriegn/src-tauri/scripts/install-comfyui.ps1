<#
  Novaura Sovereign - one-click ComfyUI installer.
  Embedded in the app (src-tauri/src/engines.rs) and run with validated arguments.

  Needs nothing preinstalled except Windows' built-in curl.exe and PowerShell:
    1. uv (a small Python manager) is downloaded into the install folder.
    2. uv installs its own Python 3.12 into the install folder.
    3. A pinned ComfyUI release is downloaded as a zip.
    4. PyTorch is installed for the chosen GPU backend and verified against the
       actual card (older NVIDIA cards fall back to a release that still supports them).
  All caches live under the install folder, so the system drive does not fill up.
  Progress is written to novaura-install.status.json for the app to read.
#>
param(
  [Parameter(Mandatory = $true)][string]$InstallDir,
  [Parameter(Mandatory = $true)][ValidateSet('cu126', 'cu128', 'cpu', 'directml')][string]$TorchVariant
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$StatusFile = Join-Path $InstallDir 'novaura-install.status.json'
$ToolsDir = Join-Path $InstallDir 'tools'
$CacheDir = Join-Path $InstallDir 'cache'
$ComfyDir = Join-Path $InstallDir 'ComfyUI'
$VenvDir = Join-Path $InstallDir 'venv'
$Python = Join-Path $VenvDir 'Scripts\python.exe'

function Set-Status([string]$Phase, [string]$Message, [int]$Percent) {
  $script:Phase = $Phase
  $script:Percent = $Percent
  $obj = [ordered]@{ phase = $Phase; message = $Message; percent = $Percent; updatedAt = (Get-Date).ToString('o') }
  [System.IO.File]::WriteAllText($StatusFile, ($obj | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding $false))
  Write-Host "[$Phase] $Message"
}

# Network steps survive connection drops: each is retried with growing waits.
# Everything already downloaded stays in the cache, so a retry is quick.
function Invoke-WithRetry([string]$What, [scriptblock]$Step, [int]$Attempts = 6) {
  for ($i = 1; $i -le $Attempts; $i++) {
    & $Step
    if ($LASTEXITCODE -eq 0) { return }
    if ($i -lt $Attempts) {
      $wait = [math]::Min(120, 10 * $i * $i)
      Write-Host "$What failed (attempt $i of $Attempts). The connection may have dropped; retrying in $wait s."
      Set-Status $script:Phase "${What}: connection problem, retrying in $wait s (attempt $($i + 1) of $Attempts)" $script:Percent
      Start-Sleep -Seconds $wait
    }
  }
  throw "$What failed after $Attempts attempts. Check your internet connection and press Try again; finished downloads are kept."
}

function Get-File([string]$Url, [string]$Dest) {
  # These files are small and GitHub archives do not support resuming, so each attempt starts fresh.
  Invoke-WithRetry "Downloading $(Split-Path -Leaf $Url)" {
    if (Test-Path $Dest) { Remove-Item $Dest -Force }
    & curl.exe -L --fail --retry 4 --retry-delay 3 --silent --show-error -o $Dest $Url
  }
}

try {
  New-Item -ItemType Directory -Force -Path $InstallDir, $ToolsDir, $CacheDir | Out-Null
  $env:UV_CACHE_DIR = Join-Path $CacheDir 'uv'
  $env:UV_PYTHON_INSTALL_DIR = Join-Path $ToolsDir 'python'
  $env:UV_LINK_MODE = 'copy'
  $env:PIP_CACHE_DIR = Join-Path $CacheDir 'pip'
  $env:UV_HTTP_TIMEOUT = '120'

  # ---- Space check -----------------------------------------------------------
  $driveName = (Split-Path -Qualifier $InstallDir).TrimEnd(':')
  $freeGb = [math]::Floor((Get-PSDrive -Name $driveName).Free / 1GB)
  if ($freeGb -lt 12) { throw "Only $freeGb GB free on ${driveName}:. ComfyUI needs about 12 GB plus room for models." }
  Set-Status 'preparing' "Installing to $InstallDir ($freeGb GB free)" 2

  # ---- uv ------------------------------------------------------------------------
  $uv = Join-Path $ToolsDir 'uv\uv.exe'
  if (-not (Test-Path $uv)) {
    Set-Status 'uv' 'Downloading the Python manager (uv)' 5
    $zip = Join-Path $CacheDir 'uv.zip'
    Get-File 'https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-pc-windows-msvc.zip' $zip
    Expand-Archive -Path $zip -DestinationPath (Join-Path $ToolsDir 'uv') -Force
    Remove-Item $zip -Force
  }

  # ---- ComfyUI ---------------------------------------------------------------
  Set-Status 'comfyui' 'Downloading ComfyUI' 12
  $zipUrl = 'https://github.com/comfyanonymous/ComfyUI/archive/refs/heads/master.zip'
  $version = 'master'
  try {
    $release = Invoke-RestMethod -Uri 'https://api.github.com/repos/comfyanonymous/ComfyUI/releases/latest' -Headers @{ 'User-Agent' = 'NovauraSovereign' } -TimeoutSec 20
    if ($release.tag_name) { $version = $release.tag_name; $zipUrl = "https://github.com/comfyanonymous/ComfyUI/archive/refs/tags/$version.zip" }
  } catch { Write-Host "Could not read the latest release ($_); using master." }
  $zip = Join-Path $CacheDir 'comfyui.zip'
  Get-File $zipUrl $zip
  $extract = Join-Path $CacheDir 'comfyui-extract'
  if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
  Expand-Archive -Path $zip -DestinationPath $extract -Force
  $inner = Get-ChildItem $extract -Directory | Select-Object -First 1
  New-Item -ItemType Directory -Force -Path $ComfyDir | Out-Null
  # Copy over the existing folder: models, inputs, outputs and custom nodes are kept.
  Copy-Item -Path (Join-Path $inner.FullName '*') -Destination $ComfyDir -Recurse -Force
  Remove-Item $extract -Recurse -Force
  Remove-Item $zip -Force
  Set-Status 'comfyui' "ComfyUI $version ready" 25

  # ---- Python ----------------------------------------------------------------
  if (-not (Test-Path $Python)) {
    Set-Status 'python' 'Installing Python 3.12 (private copy)' 30
    Invoke-WithRetry 'Installing Python' { & $uv venv --python 3.12 $VenvDir }
  }

  # ---- PyTorch ---------------------------------------------------------------
  Set-Status 'torch' "Installing PyTorch ($TorchVariant). This is the big download, a few GB." 38
  if ($TorchVariant -eq 'directml') {
    Invoke-WithRetry 'Installing PyTorch' { & $uv pip install --python $Python torch-directml }
  } else {
    Invoke-WithRetry 'Installing PyTorch' { & $uv pip install --python $Python torch torchvision torchaudio --index-url "https://download.pytorch.org/whl/$TorchVariant" }
  }

  # ---- ComfyUI requirements --------------------------------------------------
  Set-Status 'requirements' 'Installing ComfyUI requirements' 70
  Invoke-WithRetry 'Installing ComfyUI requirements' { & $uv pip install --python $Python -r (Join-Path $ComfyDir 'requirements.txt') }

  # ---- Verify the GPU ----------------------------------------------------------
  Set-Status 'verify' 'Checking that PyTorch can use your GPU' 88
  $probe = @'
import json, torch
info = {"torch": torch.__version__, "cuda": torch.cuda.is_available(), "device": None, "capability": None, "archs": []}
if info["cuda"]:
    info["device"] = torch.cuda.get_device_name(0)
    info["capability"] = "%d%d" % torch.cuda.get_device_capability(0)
    info["archs"] = torch.cuda.get_arch_list()
print(json.dumps(info))
'@
  $probeFile = Join-Path $CacheDir 'probe.py'
  [System.IO.File]::WriteAllText($probeFile, $probe)
  $info = (& $Python $probeFile | Select-Object -Last 1) | ConvertFrom-Json
  if ($TorchVariant -like 'cu*') {
    $supported = $info.cuda -and ($info.archs | Where-Object { $_ -eq "sm_$($info.capability)" })
    if (-not $supported) {
      # Newer PyTorch builds dropped older cards (Maxwell/Pascal). 2.8.0 on CUDA 12.6 still supports them.
      Set-Status 'verify' "This PyTorch build does not support your GPU ($($info.device), sm_$($info.capability)); installing a compatible release" 90
      Invoke-WithRetry 'Installing a compatible PyTorch' { & $uv pip install --python $Python 'torch==2.8.0' 'torchvision==0.23.0' 'torchaudio==2.8.0' --index-url 'https://download.pytorch.org/whl/cu126' }
      $info = (& $Python $probeFile | Select-Object -Last 1) | ConvertFrom-Json
      $supported = $info.cuda -and ($info.archs | Where-Object { $_ -eq "sm_$($info.capability)" })
      if (-not $supported) { throw "PyTorch still cannot use $($info.device). ComfyUI can run on the CPU instead (choose the CPU option)." }
    }
  }

  $engine = [ordered]@{ variant = $TorchVariant; comfyui = $version; torch = $info.torch; cuda = $info.cuda; device = $info.device; capability = $info.capability; installedAt = (Get-Date).ToString('o') }
  [System.IO.File]::WriteAllText((Join-Path $InstallDir 'novaura-engine.json'), ($engine | ConvertTo-Json), (New-Object System.Text.UTF8Encoding $false))
  $device = if ($info.cuda) { $info.device } else { 'CPU' }
  Set-Status 'done' "Installed ComfyUI $version with PyTorch $($info.torch) on $device" 100
  exit 0
} catch {
  Set-Status 'failed' "$_" 100
  exit 1
}
