$ErrorActionPreference = "Stop"

Write-Host "--- Verifying Sidebar & Navigation Refactoring ---"

# 1. Verify script.js is completely untouched
$scriptDiff = git diff script.js
if ($scriptDiff -and $scriptDiff.Trim().Length -gt 0) {
    Write-Error "[FAIL] script.js was modified! Expected zero diff."
} else {
    Write-Host "[PASS] script.js is strictly untouched"
}

# 2. Verify critical IDs
$indexContent = [System.IO.File]::ReadAllText("index.html", [System.Text.Encoding]::UTF8)
$styleContent = [System.IO.File]::ReadAllText("style.css", [System.Text.Encoding]::UTF8)

$criticalIds = @(
    'id="sidebarToggle"',
    'id="authSidebarAccount"',
    'id="authSidebarName"',
    'id="authSidebarEmail"',
    'id="authLogoutBtn"',
    'id="sidebarLiveClock"',
    'id="Manila_z42c"',
    'id="themeToggle"',
    'id="edrTabBtn"',
    'id="cctvTabBtn"',
    'id="maintenanceTabBtn"',
    'id="eodTabBtn"',
    'id="masterlistTabBtn"',
    'id="followupTabBtn"',
    'id="globalHistoryBtn"'
)

foreach ($id in $criticalIds) {
    if (-not $indexContent.Contains($id)) {
        Write-Error "[FAIL] Missing critical element: $id in index.html"
    }
}
Write-Host "[PASS] All critical sidebar IDs verified present in index.html"

# 3. Verify CSS rules in both files
$cssPatterns = @(
    '#sidebarToggle',
    'left: 242px',
    'left: 68px',
    'rotate(180deg)',
    'ops-sidebar-brand',
    'background: transparent',
    'border: none',
    'box-shadow: none',
    'auth-sidebar-account',
    'authLogoutBtn',
    'sidebar-live-clock'
)

foreach ($pattern in $cssPatterns) {
    if (-not $indexContent.Contains($pattern)) {
        Write-Error "[FAIL] Pattern '$pattern' not found in index.html"
    }
    if (-not $styleContent.Contains($pattern)) {
        Write-Error "[FAIL] Pattern '$pattern' not found in style.css"
    }
}
Write-Host "[PASS] All required CSS rules present in both index.html and style.css"

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

Write-Host "--- ALL SIDEBAR REFACTORING CHECKS PASSED ---"
