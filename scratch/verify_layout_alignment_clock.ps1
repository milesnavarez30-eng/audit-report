$ErrorActionPreference = "Stop"

Write-Host "--- Verifying Layout Clutter, Button Alignment, and Clock Typography ---"

# 1. Verify script.js is completely untouched
$scriptDiff = git diff script.js
if ($scriptDiff -and $scriptDiff.Trim().Length -gt 0) {
    Write-Error "[FAIL] script.js was modified! Expected zero diff."
} else {
    Write-Host "[PASS] script.js is strictly untouched"
}

# 2. Verify critical IDs in index.html
$indexContent = [System.IO.File]::ReadAllText("index.html", [System.Text.Encoding]::UTF8)
$styleContent = [System.IO.File]::ReadAllText("style.css", [System.Text.Encoding]::UTF8)

$criticalIds = @(
    'id="eodPanel"',
    'id="maintenancePanel"',
    'id="simpleEodDestination"',
    'id="simpleEodDate"',
    'id="simpleEodSaveBtn"',
    'id="simpleEodDraftsBtn"',
    'id="simpleEodCopySheetsBtn"',
    'id="simpleEodSendSheetsBtn"',
    'id="simpleEodSheetSetupBtn"',
    'id="maintenanceSheetConnectionState"',
    'id="simpleEodPreviewBtn"',
    'id="simpleEodPdfBtn"',
    'id="simpleEodClearBtn"',
    'id="simpleEodAutosaveStatus"',
    'id="simpleEodBlocks"',
    'id="simpleEodAddBtn"',
    'id="sidebarLiveClock"',
    'id="Manila_z42c"',
    'id="authLogoutBtn"',
    'id="sidebarToggle"'
)

foreach ($id in $criticalIds) {
    if (-not $indexContent.Contains($id)) {
        Write-Error "[FAIL] Missing critical element: $id in index.html"
    }
}
Write-Host "[PASS] All critical DOM IDs verified present in index.html"

# 3. Verify CSS patterns in both files
$cssPatterns = @(
    '22px !important',
    'tabular-nums !important',
    'sidebar-live-time',
    'sidebar-live-date',
    'REMOVE OUTER WORKSPACE CONTAINER',
    '#eodPanel.app-tab-panel',
    '#maintenancePanel.app-tab-panel',
    'flex-wrap: nowrap',
    'overflow-x: auto',
    '#simpleEodAutosaveStatus',
    'margin-left: auto'
)

foreach ($pattern in $cssPatterns) {
    if (-not $indexContent.Contains($pattern)) {
        Write-Error "[FAIL] Pattern '$pattern' not found in index.html"
    }
    if (-not $styleContent.Contains($pattern)) {
        Write-Error "[FAIL] Pattern '$pattern' not found in style.css"
    }
}
Write-Host "[PASS] All layout, alignment, and clock CSS rules verified in both files"

# 4. Check for UTF-8 BOM
function Check-Bom($path) {
    $bytes = [System.IO.File]::ReadAllBytes($path)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        Write-Error "[FAIL] $path has UTF-8 BOM!"
    } else {
        Write-Host "[PASS] $path is UTF-8 without BOM"
    }
}

Check-Bom "index.html"
Check-Bom "style.css"

Write-Host "--- ALL CHECKS PASSED SUCCESSFULLY ---"
