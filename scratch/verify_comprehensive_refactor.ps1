# Comprehensive Verification Script for CCTV OPS Architectural Refactoring
$ErrorActionPreference = "Stop"

Write-Host "--- Verifying Comprehensive UI/UX Architectural Refactoring ---"

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

# 2. Objective 1: Smiley / Frowny Neo-Brutalist Theme Toggle
$themePatterns = @(
    "theme-toggle-container",
    "main-toggle",
    "main-checkbox",
    "main-track",
    "main-knob",
    ":)",
    ":(",
    "#2ecc71",
    "#e74c3c"
)
foreach ($pat in $themePatterns) {
    if (-not $indexContent.Contains($pat) -and -not $styleContent.Contains($pat)) {
        Write-Error "FAIL: Missing theme toggle pattern: $pat"
    }
}
if ($indexContent -notmatch '<input type="checkbox" id="themeToggle"') {
    Write-Error "FAIL: themeToggle checkbox input missing from index.html"
}
Write-Host "[PASS] Objective 1: Smiley / Frowny Theme Switcher verified"

# 3. Objective 2: Cyber-Terminal Glitch Login Integration
$glitchPatterns = @(
    "glitch-form-wrapper",
    "glitch-card",
    "card-header",
    "card-title",
    "card-dots",
    "glitch-anim",
    "Fira Code"
)
foreach ($pat in $glitchPatterns) {
    if (-not $indexContent.Contains($pat) -and -not $styleContent.Contains($pat)) {
        Write-Error "FAIL: Missing glitch login pattern: $pat"
    }
}
if ($indexContent -notmatch 'data-text="LOG IN"') {
    Write-Error "FAIL: LOG IN glitch button text missing from index.html"
}
Write-Host "[PASS] Objective 2: Cyber-Terminal Glitch Login verified"

# 4. Objective 3: EDR & CCTV Audit Form Alignment & Docked Buttons
$formPatterns = @(
    "repeat(3, minmax(0, 1fr))",
    "input-with-actions",
    "select-action-wrapper",
    "button.add-btn",
    "button.remove-btn",
    "required-mark"
)
foreach ($pat in $formPatterns) {
    if (-not $styleContent.Contains($pat)) {
        Write-Error "FAIL: style.css missing form alignment pattern: $pat"
    }
}
Write-Host "[PASS] Objective 3: EDR & CCTV Audit Form Alignment verified"

# 5. Objective 4: Pill Textbox Styling & Slash Removal
$pillPatterns = @(
    "#212121",
    "#d8d5d5",
    ".slash-icon",
    "display: none !important"
)
foreach ($pat in $pillPatterns) {
    if (-not $styleContent.Contains($pat)) {
        Write-Error "FAIL: style.css missing pill textbox pattern: $pat"
    }
}
Write-Host "[PASS] Objective 4: Pill Textbox Styling & Slash Removal verified"

# 6. Objective 5: Maintenance Tab & Toolbar Overhaul
$maintenancePatterns = @(
    "min-height: 52px",
    "flex-wrap: wrap",
    "#10b981",
    "#0284c7"
)
foreach ($pat in $maintenancePatterns) {
    if (-not $styleContent.Contains($pat)) {
        Write-Error "FAIL: style.css missing maintenance pattern: $pat"
    }
}
Write-Host "[PASS] Objective 5: Maintenance Tab & Toolbar Overhaul verified"

# 7. Objective 6: Sidebar Streamlining & Prominent Clock
$sidebarPatterns = @(
    "sidebarToggle",
    "font-size: 22px",
    "tabular-nums"
)
foreach ($pat in $sidebarPatterns) {
    if (-not $styleContent.Contains($pat)) {
        Write-Error "FAIL: style.css missing sidebar pattern: $pat"
    }
}
Write-Host "[PASS] Objective 6: Sidebar Streamlining & Prominent Clock verified"

# 8. Objective 7: Unified Typography
if (-not $styleContent.Contains("Plus Jakarta Sans")) {
    Write-Error "FAIL: Plus Jakarta Sans typography missing from style.css"
}
Write-Host "[PASS] Objective 7: Unified Typography verified"

# 9. Verify UTF-8 No BOM
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

# 10. Check Critical DOM IDs
$criticalIds = @(
    "themeToggle",
    "sidebarToggle",
    "authGate",
    "authForms",
    "authSignInForm",
    "authSignInUsername",
    "authSignInPassword",
    "authSignInBtn",
    "authSignUpForm",
    "authSignUpBtn",
    "auditDate",
    "site",
    "tlName",
    "agentName",
    "omName",
    "maintenancePanel",
    "eodPanel",
    "simpleEodDestination",
    "simpleEodDate",
    "simpleEodPdfBtn"
)
foreach ($id in $criticalIds) {
    if ($indexContent -notmatch "id=['`"]$id['`"]") {
        Write-Error "FAIL: Missing critical ID: $id"
    }
}
Write-Host "[PASS] All critical DOM IDs confirmed present in index.html"

Write-Host "--- ALL COMPREHENSIVE ARCHITECTURAL REFACTORING CHECKS PASSED ---"
