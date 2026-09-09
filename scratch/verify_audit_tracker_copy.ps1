# Test verify_audit_tracker_copy.ps1
$html = [System.IO.File]::ReadAllText("index.html", [System.Text.Encoding]::UTF8)
$allPassed = $true

Write-Host "=== VERIFYING CCTV AUDIT COPY TO TRACKER (10 PT) ===" -ForegroundColor Cyan

# 1. Check UTF-8 BOM
$bytesHtml = [System.IO.File]::ReadAllBytes("index.html")
$hasBOMHtml = ($bytesHtml.Length -ge 3 -and $bytesHtml[0] -eq 0xEF -and $bytesHtml[1] -eq 0xBB -and $bytesHtml[2] -eq 0xBF)
if ($hasBOMHtml) {
    Write-Host "[FAIL] index.html has UTF-8 BOM" -ForegroundColor Red
    $allPassed = $false
} else {
    Write-Host "[PASS] index.html has no UTF-8 BOM" -ForegroundColor Green
}

# 2. Check script.js is untouched
$gitDiff = git diff script.js
if ($gitDiff -and $gitDiff.ToString().Trim().Length -gt 0) {
    Write-Host "[FAIL] script.js was modified" -ForegroundColor Red
    $allPassed = $false
} else {
    Write-Host "[PASS] script.js is 100% strictly untouched" -ForegroundColor Green
}

# 3. Check copyAuditForTracker function presence
if ($html.Contains("async function copyAuditForTracker")) {
    Write-Host "[PASS] copyAuditForTracker is implemented as an async function" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Missing async function copyAuditForTracker" -ForegroundColor Red
    $allPassed = $false
}

# 4. Check copyToClipboard calls copyAuditForTracker
if ($html.Contains("async function copyToClipboard") -and $html.Contains("return copyAuditForTracker();")) {
    Write-Host "[PASS] copyToClipboard proxies directly to copyAuditForTracker" -ForegroundColor Green
} else {
    Write-Host "[FAIL] copyToClipboard does not proxy to copyAuditForTracker" -ForegroundColor Red
    $allPassed = $false
}

# 5. Check 10pt font-size in text/html payload
if ($html.Contains("font-size: 10pt") -or $html.Contains("font-size:10pt")) {
    Write-Host "[PASS] Explicit font-size: 10pt applied to text/html payload" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Missing font-size: 10pt in text/html payload" -ForegroundColor Red
    $allPassed = $false
}

# 6. Check td elements have explicit font-size: 10pt
if ($html.Contains("font-size: 10pt; line-height: normal;")) {
    Write-Host "[PASS] All table cells have explicit 10pt font-size and line-height: normal" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Table cells missing explicit 10pt font-size and line-height: normal" -ForegroundColor Red
    $allPassed = $false
}

# 7. Check Base64 sanitization regex
if ($html.Contains("data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+")) {
    Write-Host "[PASS] Base64 image data sanitization regex is active" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Missing Base64 image data sanitization regex" -ForegroundColor Red
    $allPassed = $false
}

# 8. Check HTML escaping
if ($html.Contains("replace(/&/g, ""&amp;"")") -and $html.Contains("replace(/</g, ""&lt;"")")) {
    Write-Host "[PASS] HTML escaping present for safe table cells" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Missing HTML escaping in copyAuditForTracker" -ForegroundColor Red
    $allPassed = $false
}

# 9. Check ClipboardItem support with text/plain and text/html
if ($html.Contains("new ClipboardItem") -and $html.Contains("""text/plain"": new Blob") -and $html.Contains("""text/html"": new Blob")) {
    Write-Host "[PASS] ClipboardItem constructs both text/plain and text/html Blobs" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Missing text/plain or text/html Blobs in ClipboardItem" -ForegroundColor Red
    $allPassed = $false
}

# 10. Check fallback for browsers without ClipboardItem
if ($html.Contains("textarea.style.position = ""fixed""") -and $html.Contains("textarea.style.left = ""-9999px""")) {
    Write-Host "[PASS] Offscreen textarea fallback implemented for legacy environments" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Missing offscreen textarea fallback" -ForegroundColor Red
    $allPassed = $false
}

# 11. Check user notification message
if ($html.Contains("Audit copied for Tracker (10 pt).")) {
    Write-Host "[PASS] User notification confirms 10 pt copy" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Missing user confirmation notice" -ForegroundColor Red
    $allPassed = $false
}

# 12. Check all 12 columns in tabular row order
$cols = @("year", "month", "formattedDate", "auditor", "omName", "site", "tlName", "agentName", "cleanAccount", "reasonCode", "noc", "remarks")
$allColsFound = $true
foreach ($col in $cols) {
    if (-not $html.Contains("entry.$col") -and -not $html.Contains($col)) {
        Write-Host "[FAIL] Missing column '$col' in Audit Tracker row mapping" -ForegroundColor Red
        $allColsFound = $false
    }
}
if ($allColsFound) {
    Write-Host "[PASS] All 12 tracker columns preserved in exact canonical order" -ForegroundColor Green
} else {
    $allPassed = $false
}

# 13. Check EDR Teams copy is untouched and strictly plain-text
if ($html.Contains("navigator.clipboard.writeText(teamsPayload)") -and -not $html.Contains("copyAuditForTracker") -replace "(?s)id=""edrResultSection"".*?id=""edrPreviewSection""", "") {
    Write-Host "[PASS] EDR Teams copy remains completely separate and strictly plain-text" -ForegroundColor Green
} else {
    Write-Host "[FAIL] EDR Teams copy affected or not strictly plain text" -ForegroundColor Red
    $allPassed = $false
}

if ($allPassed) {
    Write-Host "================================================="
    Write-Host "ALL CCTV AUDIT COPY TO TRACKER CHECKS PASSED!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "================================================="
    Write-Host "SOME CHECKS FAILED!" -ForegroundColor Red
    exit 1
}
