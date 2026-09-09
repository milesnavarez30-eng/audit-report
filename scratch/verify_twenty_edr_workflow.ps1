$ErrorActionPreference = "Stop"

Write-Host "=== Verifying Twenty-Inspired CCTV OPS Refinement & Smart EDR Workflow ===" -ForegroundColor Cyan

$indexPath = "index.html"
$stylePath = "style.css"

$indexContent = [System.IO.File]::ReadAllText($indexPath, [System.Text.Encoding]::UTF8)
$styleContent = [System.IO.File]::ReadAllText($stylePath, [System.Text.Encoding]::UTF8)

# 1. Script.js untouched
$scriptDiff = git status --porcelain script.js
if ($scriptDiff) {
    throw "FAIL: script.js was modified! Expected zero diff."
}
Write-Host "[PASS 1] script.js is 100% untouched" -ForegroundColor Green

# 2. Google Fonts with Inter and Plus Jakarta Sans
if (-not $indexContent.Contains("family=Inter") -or -not $indexContent.Contains("family=Plus+Jakarta+Sans")) {
    throw "FAIL: Google fonts link does not contain Inter and Plus Jakarta Sans"
}
Write-Host "[PASS 2] Typography loaded with Inter and Plus Jakarta Sans" -ForegroundColor Green

# 3. Sidebar navigation SVG line icons for all 8 items
$sidebarChecks = @(
    'id="edrTabBtn"',
    'id="cctvTabBtn"',
    'id="maintenanceTabBtn"',
    'id="eodTabBtn"',
    'id="masterlistTabBtn"',
    'id="followupTabBtn"',
    'id="globalHistoryBtn"',
    'id="adminTabBtn"'
)
foreach ($btnId in $sidebarChecks) {
    if (-not $indexContent.Contains($btnId)) {
        throw "FAIL: Missing sidebar button $btnId"
    }
}
$svgCount = ([regex]::Matches($indexContent, 'class="sidebar-nav-icon"')).Count
if ($svgCount -lt 8) {
    throw "FAIL: Expected at least 8 sidebar-nav-icon SVGs, found $svgCount"
}
Write-Host "[PASS 3] Sidebar equipped with 8 Twenty-style line SVG icons" -ForegroundColor Green

# 4. EDR Quick Templates & Smart Assistant Elements
$edrElements = @(
    'id="edrQuickTemplates"',
    'value="away"',
    'value="sleeping"',
    'value="phone"',
    'value="pcturnedoff"',
    'value="loitering"',
    'value="unattended"',
    'id="edrRoughNotes"',
    'id="edrGenerateSmartBtn"',
    'window.generateEdrSmartContent'
)
foreach ($el in $edrElements) {
    if (-not $indexContent.Contains($el)) {
        throw "FAIL: Missing EDR smart element or script pattern: $el"
    }
}
Write-Host "[PASS 4] EDR Quick Templates (6 violation presets), Rough Notes, and 'Generate EDR' button verified" -ForegroundColor Green

# 5. Segmented Controls & Preserved Form IDs
$preservedIds = @(
    'id="edrSite"',
    'id="edrDate"',
    'id="edrTimeObserved"',
    'id="edrSupervisorRole"',
    'id="edrSupervisorRoleButtons"',
    'id="edrSupervisorName"',
    'id="edrSupervisorOptions"',
    'id="edrOmName"',
    'id="edrOmOptionsDedicated"',
    'id="edrSubjectType"',
    'id="edrSubjectTypeButtons"',
    'id="edrSubjectName"',
    'id="edrSubjectOptions"',
    'id="edrAccount"',
    'id="edrAccountOptions"',
    'id="edrIncident"',
    'id="edrActionRemarks"',
    'id="edrScreenshotZone"',
    'id="edrClipLink"',
    'id="edrSaveBtn"',
    'id="edrClearFormBtn"',
    'id="edrCancelEditBtn"'
)
foreach ($id in $preservedIds) {
    if (-not $indexContent.Contains($id)) {
        throw "FAIL: Critical EDR ID missing: $id"
    }
}
Write-Host "[PASS 5] All 22 critical EDR field IDs and segmented controls verified" -ForegroundColor Green

# 6. Twenty-Inspired CSS Design System Tokens
$tokenChecks = @(
    '--app-bg: #212121;',
    '--sidebar-bg: #1b1b1b;',
    '--surface-1: #252525;',
    '--surface-2: #292929;',
    '--surface-3: #2e2e2e;',
    '--surface-hover: #333333;',
    '--text-primary: #f4f4f5;',
    '--text-secondary: #c2c2c5;',
    '--text-muted: #8c8d91;',
    '--app-bg: #b6b8cd;',
    '--sidebar-bg: #adafc3;',
    '--surface-1: #c4c6d4;',
    '--surface-2: #d0d2dc;',
    '--surface-3: #dcdee6;',
    '--surface-hover: #d5d7e1;',
    '--text-primary: #191a1f;',
    '--text-secondary: #484a55;',
    '--text-muted: #6b6d78;',
    '--brand-primary: #2584ff;',
    '--brand-success: #22a06b;',
    '--brand-danger: #d84a4a;'
)
foreach ($token in $tokenChecks) {
    if (-not $indexContent.Contains($token) -or -not $styleContent.Contains($token)) {
        throw "FAIL: Missing token '$token' in style.css or index.html"
    }
}
Write-Host "[PASS 6] Complete Twenty-inspired Dark (#212121) and Light (#b6b8cd) token palettes verified" -ForegroundColor Green

# 7. Button and Form Radius System (6px–8px, 40px inputs)
$radiusChecks = @(
    'border-radius: 8px !important;',
    'height: 40px !important;',
    'box-shadow: none !important;'
)
foreach ($chk in $radiusChecks) {
    if (-not $indexContent.Contains($chk) -or -not $styleContent.Contains($chk)) {
        throw "FAIL: Missing button/form geometry check: $chk"
    }
}
Write-Host "[PASS 7] Standardized 8px radius, 40px inputs, and zero shadow verified" -ForegroundColor Green

# 8. No UTF-8 BOM in modified files
function Test-Utf8NoBom($path) {
    $bytes = [System.IO.File]::ReadAllBytes($path)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        throw "FAIL: $path contains UTF-8 BOM!"
    }
}
Test-Utf8NoBom "index.html"
Test-Utf8NoBom "style.css"
Write-Host "[PASS 8] Zero UTF-8 BOM confirmed across index.html and style.css" -ForegroundColor Green

Write-Host "`n=== ALL 8 TWENTY-INSPIRED CHECKS PASSED PERFECTLY ===" -ForegroundColor Green
