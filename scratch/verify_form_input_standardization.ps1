# Verification script for Global Form Input & Select Standardization
$ErrorActionPreference = "Stop"

Write-Host "--- Verifying Global Form Input & Select Standardization ---"

$indexPath = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\index.html"
$stylePath = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\style.css"
$scriptPath = "c:\Users\Mnavares\Documents\CCTV OPS\audit-report\script.js"

$indexContent = [System.IO.File]::ReadAllText($indexPath, [System.Text.Encoding]::UTF8)
$styleContent = [System.IO.File]::ReadAllText($stylePath, [System.Text.Encoding]::UTF8)

# 1. Verify script.js is completely untouched
$gitDiffScript = & git status --porcelain script.js
if ($gitDiffScript) {
    Write-Error "FAIL: script.js has uncommitted or modified changes!"
} else {
    Write-Host "[PASS] script.js is strictly untouched"
}

# 2. Verify all required CSS rules in style.css and index.html
$patterns = @(
    "GLOBAL FORM INPUT & SELECT STANDARDIZATION",
    "height: 40px !important",
    "min-height: 40px !important",
    "max-height: 40px !important",
    "line-height: 38px !important",
    "padding: 0 14px !important",
    "border-radius: 10px !important",
    "letter-spacing: 0.06em !important",
    "text-transform: uppercase !important",
    "grid-template-columns: 1fr 280px !important",
    "align-items: flex-end !important",
    "::-webkit-calendar-picker-indicator"
)

foreach ($pat in $patterns) {
    if (-not $styleContent.Contains($pat)) {
        Write-Error "FAIL: style.css is missing expected pattern: $pat"
    }
    if (-not $indexContent.Contains($pat)) {
        Write-Error "FAIL: index.html is missing expected pattern: $pat"
    }
}
Write-Host "[PASS] All form standardization CSS rules verified in style.css and index.html"

# 3. Verify UTF-8 No BOM
$styleBytes = [System.IO.File]::ReadAllBytes($stylePath)
if ($styleBytes[0] -eq 0xEF -and $styleBytes[1] -eq 0xBB -and $styleBytes[2] -eq 0xBF) {
    Write-Error "FAIL: style.css has UTF-8 BOM"
} else {
    Write-Host "[PASS] style.css is UTF-8 without BOM"
}

$indexBytes = [System.IO.File]::ReadAllBytes($indexPath)
if ($indexBytes[0] -eq 0xEF -and $indexBytes[1] -eq 0xBB -and $indexBytes[2] -eq 0xBF) {
    Write-Error "FAIL: index.html has UTF-8 BOM"
} else {
    Write-Host "[PASS] index.html is UTF-8 without BOM"
}

# 4. Verify Critical Form IDs and Event Bindings
$formIds = @(
    "simpleEodDestination",
    "simpleEodDate",
    "simpleEodSite"
)

foreach ($id in $formIds) {
    if ($indexContent -notmatch "id=['`"]$id['`"]") {
        Write-Error "FAIL: Missing ID $id"
    }
}
Write-Host "[PASS] All form IDs confirmed present in index.html"

Write-Host "--- ALL FORM INPUT & SELECT STANDARDIZATION CHECKS PASSED ---"
