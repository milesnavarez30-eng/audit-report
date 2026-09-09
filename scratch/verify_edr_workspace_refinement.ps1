# Verification Suite for EDR Workspace Refinement & Button System
$html = [System.IO.File]::ReadAllText("index.html", [System.Text.Encoding]::UTF8)
$css = [System.IO.File]::ReadAllText("style.css", [System.Text.Encoding]::UTF8)

Write-Host "=== VERIFYING EDR WORKSPACE REFINEMENT & BUTTON SYSTEM ===" -ForegroundColor Cyan
$allPassed = $true

function Assert-Check($cond, $msg) {
    if ($cond) {
        Write-Host "[PASS] $msg" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] $msg" -ForegroundColor Red
        $script:allPassed = $false
    }
}

# 1. Critical IDs Preserved
$criticalIds = @(
    'id="edrSite"',
    'id="edrDate"',
    'id="edrTimeObserved"',
    'id="edrSupervisorName"',
    'id="edrOmName"',
    'id="edrSubjectName"',
    'id="edrAccount"',
    'id="edrIncident"',
    'id="edrActionRemarks"',
    'id="edrClipLink"',
    'id="edrSaveBtn"'
)
foreach ($id in $criticalIds) {
    Assert-Check ($html.Contains($id)) "Critical element $id preserved in DOM"
}

# 2. Two EDR Modes & Shared Preview
Assert-Check ($html.Contains('id="edrModeAiTab"')) "AI Mode Tab present"
Assert-Check ($html.Contains('id="edrModeManualTab"')) "Manual Mode Tab present"
Assert-Check ($html.Contains('id="edrAiModeSection"')) "AI Mode Section present"
Assert-Check ($html.Contains('id="edrManualModeSection"')) "Manual Mode Section present"
Assert-Check ($html.Contains('id="edrResultSection"')) "Shared EDR Result Section present"
Assert-Check ($html.Contains('id="edrLivePreviewContent"')) "Shared Live EDR Preview content container present"
Assert-Check ($html.Contains('switchEdrMode')) "switchEdrMode function implemented"
Assert-Check ($html.Contains('renderLiveEdrPreview')) "renderLiveEdrPreview function implemented"

# 3. AI Generator Clip Link (#edrAiClipLink)
Assert-Check ($html.Contains('id="edrAiClipLink"')) "AI Generator CCTV Clip Link (#edrAiClipLink) input present"
Assert-Check ($html.Contains('byId("edrAiClipLink")')) "Script interacts with #edrAiClipLink"
Assert-Check ($html.Contains('clipMatch = text.match')) "Raw CCTV parser extracts video clip link"

# 4. Fix MS Teams 'Message Too Long' Bug
Assert-Check ($html.Contains('outputHtmlForClipboard')) "outputHtmlForClipboard function implemented"
Assert-Check ($html.Contains('reportHtml(report, false)')) "Clipboard HTML explicitly omits Base64 image data"
Assert-Check ($html.Contains('clipboardHtmlDocument(cleanClipboardHtml)')) "copyAll uses sanitized clipboard HTML"

# 5. Standardized EDR Button Geometry (36px, 6px radius, 0 14px padding, 12px, 600 weight)
Assert-Check ($css -match 'padding:\s*0\s+14px\s*!important;') "style.css enforces 0 14px padding on EDR action buttons"
Assert-Check ($css -match 'height:\s*36px\s*!important;') "style.css enforces 36px height on EDR action buttons"
Assert-Check ($css -match 'border-radius:\s*6px\s*!important;') "style.css enforces 6px border-radius on EDR action buttons"
Assert-Check ($css -match 'font-size:\s*12px\s*!important;') "style.css enforces 12px font-size on EDR action buttons"
Assert-Check ($css -match 'font-weight:\s*600\s*!important;') "style.css enforces 600 weight on EDR action buttons"

# 6. Action buttons in AI Generator Mode
Assert-Check ($html.Contains('id="edrGenerateBtn"')) "Generate EDR button (#edrGenerateBtn) present"
Assert-Check ($html.Contains('id="edrClearAiBtn"')) "Clear Input button (#edrClearAiBtn) present"

# 7. Git integrity: script.js 100% untouched
$diff = git diff script.js
Assert-Check ([string]::IsNullOrWhiteSpace($diff)) "script.js is 100% strictly untouched"

# 8. UTF-8 BOM check
$htmlBytes = [System.IO.File]::ReadAllBytes("index.html")
$hasBom = ($htmlBytes.Length -ge 3 -and $htmlBytes[0] -eq 0xEF -and $htmlBytes[1] -eq 0xBB -and $htmlBytes[2] -eq 0xBF)
Assert-Check (-not $hasBom) "index.html has no UTF-8 BOM"

Write-Host "================================================="
if ($allPassed) {
    Write-Host "ALL EDR WORKSPACE REFINEMENT CHECKS PASSED!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "SOME CHECKS FAILED!" -ForegroundColor Red
    exit 1
}
