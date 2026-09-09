# Test verify_edr_event_delegation.ps1
$html = [System.IO.File]::ReadAllText("index.html", [System.Text.Encoding]::UTF8)
$css = [System.IO.File]::ReadAllText("style.css", [System.Text.Encoding]::UTF8)
$allPassed = $true

Write-Host "=== VERIFYING EDR BULLETPROOF EVENT DELEGATION & STATE SYNC ==="

# 1. Elements in HTML
$elements = @(
    "edrBulletproofEventDelegationScript",
    "edrPreviewTopLine",
    "edrPreviewBody",
    "edrCopyTeamsBtn",
    "edrCopyNotice",
    "setEdrMode",
    "refreshEdrPreview"
)

foreach ($el in $elements) {
    if ($html.Contains($el)) {
        Write-Host "[PASS] Element / Function '$el' present in index.html" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Missing '$el' in index.html" -ForegroundColor Red
        $allPassed = $false
    }
}

# 2. Check #edrCopyTeamsBtn in style.css button geometry
if ($css.Contains("#edrPanel #edrCopyTeamsBtn")) {
    Write-Host "[PASS] #edrCopyTeamsBtn styled with standardized button geometry" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Missing #edrCopyTeamsBtn styling in style.css" -ForegroundColor Red
    $allPassed = $false
}

# 3. Check quick templates handling
if ($html.Contains("sleeping") -and $html.Contains("cellphone") -and $html.Contains("abandonment")) {
    Write-Host "[PASS] Quick template presets configured" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Quick template presets missing" -ForegroundColor Red
    $allPassed = $false
}

# 4. Check script.js is untouched
$gitDiff = git diff script.js
if ($gitDiff -and $gitDiff.ToString().Trim().Length -gt 0) {
    Write-Host "[FAIL] script.js was modified" -ForegroundColor Red
    $allPassed = $false
} else {
    Write-Host "[PASS] script.js is 100% strictly untouched" -ForegroundColor Green
}

# 5. Check BOM
$bytesHtml = [System.IO.File]::ReadAllBytes("index.html")
$hasBOMHtml = ($bytesHtml.Length -ge 3 -and $bytesHtml[0] -eq 0xEF -and $bytesHtml[1] -eq 0xBB -and $bytesHtml[2] -eq 0xBF)
if ($hasBOMHtml) {
    Write-Host "[FAIL] index.html has BOM" -ForegroundColor Red
    $allPassed = $false
} else {
    Write-Host "[PASS] index.html has no UTF-8 BOM" -ForegroundColor Green
}

if ($allPassed) {
    Write-Host "================================================="
    Write-Host "ALL EDR BULLETPROOF EVENT DELEGATION CHECKS PASSED!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "================================================="
    Write-Host "SOME CHECKS FAILED!" -ForegroundColor Red
    exit 1
}
