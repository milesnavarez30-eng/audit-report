# Verifying Compact Screenshot Overhaul
$ErrorActionPreference = 'Stop'
Write-Host '--- Verifying Compact Screenshot Overhaul ---'

# 1. script.js check
$scriptDiff = git status --porcelain script.js
if ($scriptDiff) { throw 'script.js modified!' }
Write-Host '[PASS] script.js untouched'

# 2. CSS checks in index.html & style.css
$index = [System.IO.File]::ReadAllText('index.html', [System.Text.Encoding]::UTF8)
$style = [System.IO.File]::ReadAllText('style.css', [System.Text.Encoding]::UTF8)

$checks = @(
    'min-height: 52px !important',
    'flex-direction: row !important',
    'height: 34px !important',
    'max-height: 44px !important',
    'width: 18px !important',
    'height: 18px !important',
    'top: -5px !important',
    'right: -5px !important',
    '.eod-proof-zone',
    '.eod-proof-label',
    '.eod-proof-grid',
    '.eod-proof-item',
    '.eod-proof-remove'
)

foreach ($c in $checks) {
    if (-not $index.Contains($c)) { throw "index.html missing: $c" }
    if (-not $style.Contains($c)) { throw "style.css missing: $c" }
}
Write-Host '[PASS] All CSS rules present in index.html and style.css'

# 3. UTF-8 BOM check
$ib = [System.IO.File]::ReadAllBytes('index.html')
if ($ib[0] -eq 0xEF -and $ib[1] -eq 0xBB -and $ib[2] -eq 0xBF) { throw 'index.html has BOM' }
$sb = [System.IO.File]::ReadAllBytes('style.css')
if ($sb[0] -eq 0xEF -and $sb[1] -eq 0xBB -and $sb[2] -eq 0xBF) { throw 'style.css has BOM' }
Write-Host '[PASS] No UTF-8 BOM in index.html and style.css'

# 4. Critical DOM IDs check
$existingVerification = & powershell -ExecutionPolicy Bypass -File scratch/verify_maintenance_overhaul.ps1
Write-Host $existingVerification

Write-Host '--- ALL CHECKS PASSED ---'
