# Verification script for EDR AI Generator CCTV Screenshot zone
$htmlPath = "index.html"
$scriptPath = "script.js"

$bytes = [System.IO.File]::ReadAllBytes($htmlPath)
if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    Write-Error "index.html contains UTF-8 BOM!"
    exit 1
}

$gitDiff = git status --porcelain script.js
if ($gitDiff) {
    Write-Error "script.js was modified! Diff: $gitDiff"
    exit 1
}

$html = [System.IO.File]::ReadAllText($htmlPath)

$checks = @(
    "id=`"edrAiScreenshotZone`"",
    "id=`"edrAiScreenshotInput`"",
    "id=`"edrAiScreenshotEmpty`"",
    "id=`"edrAiChooseScreenshotBtn`"",
    "id=`"edrAiViewCurrentScreenshotBtn`"",
    "id=`"edrAiScreenshotPreviewWrap`"",
    "id=`"edrAiScreenshotPreview`"",
    "id=`"edrAiViewBtn`"",
    "id=`"edrAiReplaceScreenshotBtn`"",
    "id=`"edrAiRemoveScreenshotBtn`"",
    "aiScreenshotZone = byId(`"edrAiScreenshotZone`")",
    "aiScreenshotInput = byId(`"edrAiScreenshotInput`")",
    "byId(`"edrAiChooseScreenshotBtn`")",
    "byId(`"edrAiReplaceScreenshotBtn`")",
    "byId(`"edrAiRemoveScreenshotBtn`")",
    "const aiEmpty = byId(`"edrAiScreenshotEmpty`")",
    "const aiWrap = byId(`"edrAiScreenshotPreviewWrap`")",
    "const aiImg = byId(`"edrAiScreenshotPreview`")"
)

foreach ($check in $checks) {
    if (-not $html.Contains($check)) {
        Write-Error "Missing check: $check"
        exit 1
    }
    Write-Host "[PASS] Found: $check"
}

Write-Host "`n>>> ALL EDR AI SCREENSHOT CHECKS PASSED! <<<"
exit 0
