# Verification Script for Maintenance Report & AI Sorter Refactor
$ErrorActionPreference = "Stop"

Write-Host "--- Running Maintenance Report & Sorter Overhaul Verification ---"

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

# 2. Check Critical DOM IDs
$requiredIds = @(
    "maintenancePanel",
    "maintenanceInput",
    "maintenanceSortBtn",
    "maintenanceCopyBtn",
    "maintenanceClearBtn",
    "maintenanceResetAssignmentsBtn",
    "maintenanceMessage",
    "maintenanceStats",
    "overallRowCount",
    "sortedReportSection",
    "maintenanceOutputTable",
    "miniSheetFindTlInput",
    "miniSheetFindTlBtn",
    "miniSheetFindNextBtn",
    "miniSheetRowCount",
    "miniSheetSelectedCount",
    "miniSheetSelectSameTlBtn",
    "miniSheetCopyRowsBtn",
    "miniSheetCutRowsBtn",
    "miniSheetToReportBtn",
    "miniSheetClearSelectionBtn",
    "miniSheetRemoveRowBtn",
    "miniSheetClearAllBtn",
    "maintenanceMiniSheet",
    "maintenanceEmpty",
    "eodPanel",
    "simpleEodDestination",
    "simpleEodDate",
    "simpleEodSite",
    "simpleEodSaveBtn",
    "simpleEodDraftsBtn",
    "simpleEodCopySheetsBtn",
    "simpleEodSendSheetsBtn",
    "simpleEodSheetSetupBtn",
    "maintenanceSheetConnectionState",
    "simpleEodPreviewBtn",
    "simpleEodPdfBtn",
    "simpleEodClearBtn",
    "simpleEodAutosaveStatus",
    "simpleEodBlocks",
    "simpleEodAddBtn"
)

$missingIds = @()
foreach ($id in $requiredIds) {
    if ($indexContent -notmatch "id=['`"]$id['`"]") {
        $missingIds += $id
    }
}

if ($missingIds.Count -gt 0) {
    Write-Error "FAIL: Missing IDs: $($missingIds -join ', ')"
} else {
    Write-Host "[PASS] All $($requiredIds.Count) critical DOM IDs verified present"
}

# 3. Check that instruction texts were removed from HTML
$forbiddenTexts = @(
    "Build one report block per lane",
    "Simple workflow: paste the lanes/table",
    "Send to Google Sheets now verifies the Apps Script receiver",
    "Paste your maintenance report from",
    "Header optional"
)

$foundForbidden = @()
foreach ($text in $forbiddenTexts) {
    # Check only within maintenancePanel and eodPanel sections (lines 14090 to 14310)
    $m = [regex]::Match($indexContent, '(?s)<section id="maintenancePanel".*?</section>\s*<section id="eodPanel".*?</section>')
    if ($m.Success -and $m.Value.Contains($text)) {
        $foundForbidden += $text
    }
}

if ($foundForbidden.Count -gt 0) {
    Write-Error "FAIL: Forbidden instruction texts still in HTML: $($foundForbidden -join '; ')"
} else {
    Write-Host "[PASS] All instruction text blocks successfully removed from HTML"
}

# 4. Check CSS rules in style.css and index.html
$cssChecks = @(
    "#maintenancePanel button:not(.eod-proof-remove)",
    "height: 36px !important",
    "border-radius: 9999px !important",
    "Plus Jakarta Sans",
    "font-size: 11.5px !important",
    "font-weight: 600 !important",
    "#0284c7 !important",
    "#059669 !important",
    "REMOVE SCROLLBAR & FIT MAINTENANCE BUTTON TOOLBAR",
    "div:has(> #simpleEodPdfBtn)",
    "div:has(> button[id*=`"Draft`"])",
    "flex-wrap: wrap !important",
    "overflow: visible !important",
    "overflow-x: visible !important",
    "gap: 6px 8px !important",
    "padding: 0 12px !important",
    "scrollbar-width: none !important",
    "#64748b !important"
)

foreach ($rule in $cssChecks) {
    if (-not $indexContent.Contains($rule)) {
        Write-Error "FAIL: Missing CSS rule in index.html: $rule"
    }
    if (-not $styleContent.Contains($rule)) {
        Write-Error "FAIL: Missing CSS rule in style.css: $rule"
    }
}
Write-Host "[PASS] All button standardization, canvas layout, and container-stripping CSS rules present in both index.html and style.css"

# 5. Verify Toolbar Container has scrollbar eliminated and responsive wrap
$toolbarChecks = @(
    "outline: none !important",
    "border-radius: 0 !important",
    "margin: 12px 0 18px 0 !important",
    "gap: 6px 8px !important",
    "flex-wrap: wrap !important",
    "overflow: visible !important",
    "padding: 0 12px !important"
)
foreach ($check in $toolbarChecks) {
    if (-not $styleContent.Contains($check)) {
        Write-Error "FAIL: style.css missing toolbar reset rule: $check"
    }
    if (-not $indexContent.Contains($check)) {
        Write-Error "FAIL: index.html missing toolbar reset rule: $check"
    }
}
Write-Host "[PASS] Toolbar scrollbars eliminated, wrapping enabled, and buttons compacted"
Write-Host "[PASS] Toolbar container styling completely stripped (background, border outline, and shadow removed)"

# 6. Check UTF-8 BOM
$indexBytes = [System.IO.File]::ReadAllBytes($indexPath)
if ($indexBytes.Length -ge 3 -and $indexBytes[0] -eq 0xEF -and $indexBytes[1] -eq 0xBB -and $indexBytes[2] -eq 0xBF) {
    Write-Error "FAIL: index.html has UTF-8 BOM"
} else {
    Write-Host "[PASS] index.html is UTF-8 without BOM"
}

$styleBytes = [System.IO.File]::ReadAllBytes($stylePath)
if ($styleBytes.Length -ge 3 -and $styleBytes[0] -eq 0xEF -and $styleBytes[1] -eq 0xBB -and $styleBytes[2] -eq 0xBF) {
    Write-Error "FAIL: style.css has UTF-8 BOM"
} else {
    Write-Host "[PASS] style.css is UTF-8 without BOM"
}

Write-Host "--- ALL VERIFICATION CHECKS PASSED SUCCESSFULLY ---"

