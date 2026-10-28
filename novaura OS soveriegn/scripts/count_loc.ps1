param(
    [string]$TargetPath = "."
)

$exts = @{
    '.js'   = 'JavaScript'
    '.jsx'  = 'React JSX'
    '.ts'   = 'TypeScript'
    '.tsx'  = 'React TSX'
    '.css'  = 'CSS'
    '.html' = 'HTML'
    '.rs'   = 'Rust'
    '.py'   = 'Python'
    '.json' = 'JSON Config'
    '.ps1'  = 'PowerShell'
}

$results = @{}
foreach ($v in $exts.Values) {
    $results[$v] = [PSCustomObject]@{ Files = 0; Lines = 0 }
}

$allFiles = Get-ChildItem -Path $TargetPath -Recurse -File | Where-Object {
    $_.FullName -notmatch '[\\/](node_modules|dist|target|\.git|\.cargo|\.system_generated|\.agents)[\\/]'
}

foreach ($f in $allFiles) {
    $ext = $f.Extension.ToLower()
    if ($exts.ContainsKey($ext)) {
        $type = $exts[$ext]
        $lineCount = 0
        try {
            $lineCount = (Get-Content -LiteralPath $f.FullName -ErrorAction SilentlyContinue | Measure-Object -Line).Lines
        } catch {}
        $results[$type].Files += 1
        $results[$type].Lines += $lineCount
    }
}

$totalLines = 0
$totalFiles = 0

Write-Host '=========================================================='
Write-Host "METRICS FOR: $TargetPath"
Write-Host '=========================================================='

$rows = @()
foreach ($k in $results.Keys) {
    $totalLines += $results[$k].Lines
    $totalFiles += $results[$k].Files
    $rows += [PSCustomObject]@{
        Language    = $k
        Files       = $results[$k].Files
        LinesOfCode = $results[$k].Lines
    }
}

$rows | Sort-Object -Property LinesOfCode -Descending | Format-Table -AutoSize

Write-Host '----------------------------------------------------------'
Write-Host "TOTAL FILES: $totalFiles"
Write-Host "TOTAL LINES OF CODE: $totalLines"
Write-Host '=========================================================='
