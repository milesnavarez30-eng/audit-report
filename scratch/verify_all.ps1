$files = @("index.html", "style.css", "script.js")
$allPassed = $true

Write-Host "=== 1. CHECKING BOM ==="
foreach ($f in $files) {
    $bytes = [System.IO.File]::ReadAllBytes($f)
    $hasBOM = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
    if ($hasBOM) {
        Write-Host "FAIL: $f has UTF-8 BOM" -ForegroundColor Red
        $allPassed = $false
    } else {
        Write-Host "PASS: $f has no BOM" -ForegroundColor Green
    }
}

Write-Host "`n=== 2. SCRIPT.JS UNTOUCHED ==="
$gitDiffScript = git diff script.js
if ($gitDiffScript -and $gitDiffScript.ToString().Trim().Length -gt 0) {
    Write-Host "FAIL: script.js has uncommitted modifications" -ForegroundColor Red
    $allPassed = $false
} else {
    Write-Host "PASS: script.js is completely untouched" -ForegroundColor Green
}

Write-Host "`n=== 3. RUNNING SCRATCH\CHECK_JS_SYNTAX.PS1 ==="
& .\scratch\check_js_syntax.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAIL: check_js_syntax failed" -ForegroundColor Red
    $allPassed = $false
} else {
    Write-Host "PASS: check_js_syntax passed" -ForegroundColor Green
}

Write-Host "`n=== 4. RUNNING SCRATCH\TEST_EDR_RAW_IMPORT.PS1 ==="
& .\scratch\test_edr_raw_import.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAIL: test_edr_raw_import failed" -ForegroundColor Red
    $allPassed = $false
} else {
    Write-Host "PASS: test_edr_raw_import passed" -ForegroundColor Green
}

Write-Host "`n=== 5. CHECKING DIRECT HEADER NAVIGATION ==="
& .\scratch\verify_direct_header.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAIL: verify_direct_header failed" -ForegroundColor Red
    $allPassed = $false
} else {
    Write-Host "PASS: verify_direct_header passed" -ForegroundColor Green
}

Write-Host "`n=== 6. CHECKING UNIVERSAL WORKSPACE LAYOUT ==="
& .\scratch\verify_universal_workspace_layout.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAIL: verify_universal_workspace_layout failed" -ForegroundColor Red
    $allPassed = $false
} else {
    Write-Host "PASS: verify_universal_workspace_layout passed" -ForegroundColor Green
}

Write-Host "`n=== 7. CHECKING THEME GEOMETRY INVARIANCE ==="
& .\scratch\verify_theme_geometry_invariance.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAIL: verify_theme_geometry_invariance failed" -ForegroundColor Red
    $allPassed = $false
} else {
    Write-Host "PASS: verify_theme_geometry_invariance passed" -ForegroundColor Green
}

Write-Host "`n=== 8. CHECKING EDR WORKSPACE REFINEMENT & BUTTON SYSTEM ==="
& .\scratch\verify_edr_workspace_refinement.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAIL: verify_edr_workspace_refinement failed" -ForegroundColor Red
    $allPassed = $false
} else {
    Write-Host "PASS: verify_edr_workspace_refinement passed" -ForegroundColor Green
}

Write-Host "`n=== 9. CHECKING EDR AI GENERATOR & MANUAL ENTRY ELEMENTS ==="
$html = [System.IO.File]::ReadAllText("index.html", [System.Text.Encoding]::UTF8)

$requiredElements = @(
    "edrModeAiTab",
    "edrModeManualTab",
    "edrAiModeSection",
    "edrManualModeSection",
    "edrRawImportBanner",
    "edrRawImport",
    "edrAiClipLink",
    "edrGenerateBtn",
    "edrClearAiBtn",
    "edrAnalyzeBtn",
    "edrClearRawBtn",
    "edrRawStatus",
    "edrQuickTemplates",
    "edrLivePreviewContent",
    "switchEdrMode",
    "renderLiveEdrPreview",
    "outputHtmlForClipboard"
)

foreach ($id in $requiredElements) {
    if ($html.Contains($id)) {
        Write-Host "PASS: Found element/function '$id' in index.html" -ForegroundColor Green
    } else {
        Write-Host "FAIL: Missing element/function '$id' in index.html" -ForegroundColor Red
        $allPassed = $false
    }
}

Write-Host "`n=== 10. CHECKING EDR BULLETPROOF EVENT DELEGATION & STATE SYNC ==="
& .\scratch\verify_edr_event_delegation.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAIL: verify_edr_event_delegation failed" -ForegroundColor Red
    $allPassed = $false
} else {
    Write-Host "PASS: verify_edr_event_delegation passed" -ForegroundColor Green
}

Write-Host "`n=== 11. CHECKING CCTV AUDIT COPY TO TRACKER (10 PT) ==="
& .\scratch\verify_audit_tracker_copy.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAIL: verify_audit_tracker_copy failed" -ForegroundColor Red
    $allPassed = $false
} else {
    Write-Host "PASS: verify_audit_tracker_copy passed" -ForegroundColor Green
}

Write-Host "`n=== 12. CHECKING EDR AI CCTV SCREENSHOT ZONE ==="
& .\scratch\verify_edr_ai_screenshot.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAIL: verify_edr_ai_screenshot failed" -ForegroundColor Red
    $allPassed = $false
} else {
    Write-Host "PASS: verify_edr_ai_screenshot passed" -ForegroundColor Green
}

if ($allPassed) {
    Write-Host "`n>>> ALL 12 VERIFICATION SUITES PASSED SUCCESSFULLY! <<<" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n>>> SOME VERIFICATION CHECKS FAILED! <<<" -ForegroundColor Red
    exit 1
}

